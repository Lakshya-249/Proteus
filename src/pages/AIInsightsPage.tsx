import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProteinViewer from "../features/proteins/ProteinViewer";
import { getProteinMetadata, type ProteinMetadata } from "../features/proteins/pdbApi";
import { useAIInsights } from "../features/ai/useAIInsights";
import SequenceMetricGraph, { type ResidueMetric } from "../features/ai/SequenceMetricGraph";

// ==========================================
// Strongly-Typed Gemini Structural Intelligence
// ==========================================
export interface CatalyticResidue {
  resi: number;
  resn: string;
  role: string;
}

export interface FunctionalSite {
  label: string;
  chain: string;
  residues: number[];
  description: string;
  chemicalRole: string;
  druggabilityScore?: number;
}

export interface MutationVariant {
  mutation: string;
  resi: number;
  impact: string;
  clinicalSignificance: string;
  predictedDdg?: number; // In kcal/mol
  phenotype?: "neutral" | "destabilizing" | "pathogenic_loss_of_function" | "hyperactive";
}

export interface DomainRegion {
  name: string;
  start: number;
  end: number;
  function: string;
  type: "catalytic" | "binding" | "structural";
}

export interface DetailedAIInsights {
  summary: string;
  domains: DomainRegion[];
  functionalSites: FunctionalSite[];
  pathologyVariants: MutationVariant[];
}

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="h-3 w-1/3 rounded bg-white/10" />
          <div className="mt-3 h-2 w-full rounded bg-white/5" />
          <div className="mt-2 h-2 w-2/3 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

// Standard Kyte-Doolittle hydropathy values
const KYTE_DOOLITTLE: Record<string, number> = {
  I: 4.5, V: 4.2, L: 3.8, F: 2.8, C: 2.5, M: 1.9, A: 1.8,
  G: -0.4, T: -0.7, S: -0.8, W: -0.9, Y: -1.3, P: -1.6,
  H: -3.2, E: -3.5, Q: -3.5, D: -3.5, N: -3.5, K: -3.9, R: -4.5,
};

export default function AIInsightsPage() {
  const { pdbId } = useParams();
  const [protein, setProtein] = useState<ProteinMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  // Synchronized residue selection across 3D Viewer, Graph, and AI Panel
  const [selectedChain, setSelectedChain] = useState<string>("all");
  const [highlightedResidues, setHighlightedResidues] = useState<{
    chain: string;
    residues: number[];
    color: string;
  } | null>(null);

  // Active AI Inspector mode
  const [activeTab, setActiveTab] = useState<"sites" | "mutations" | "domains">("sites");
  const [selectedFeatureKey, setSelectedFeatureKey] = useState<string | null>(null);
  const [graphMetric, setGraphMetric] = useState<"hydropathy" | "charge">("hydropathy");

  const { result, loading: aiLoading,error:aiError, runInsights } = useAIInsights();

  useEffect(() => {
    if (!pdbId) return;
    async function loadProteinMetadata() {
      setLoading(true);
      try {
        getProteinMetadata(pdbId as string)
          .then(setProtein)
          .finally(() => setLoading(false));
      } catch(error) {
        console.error(error);
      }
    }

    loadProteinMetadata();
  }, [pdbId]);

  // Replace the existing "run once on protein load" effect with this:
  useEffect(() => {
    if (!protein || !pdbId) return;

    const chainId =
      selectedChain === "all"
        ? protein.chains[0]?.id
        : selectedChain;

    const chain = protein.chains.find((c) => c.id === chainId);

    if (!chain) return;

    if (chain.polymerType && !chain.polymerType.includes("polypeptide")) {
      return; // skip AI analysis for DNA/RNA chains
    }

    runInsights(pdbId, chain.id, chain.sequence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protein, selectedChain]);

  // Selected sequence chain for the interactive profiler
  const activeChainData = useMemo(() => {
    if (!protein || protein.chains.length === 0) return null;
    if (selectedChain === "all") return protein.chains[0];

    const match = protein.chains.find((c) => c.id === selectedChain);

    if (!match) {
      console.warn(`No chain found for id "${selectedChain}"`, protein.chains.map(c => c.id));
    }

    return protein.chains.find((c) => c.id === selectedChain) || protein.chains[0];
  }, [protein, selectedChain]);

  // Compute metrics per amino acid residue
  const sequenceMetrics: ResidueMetric[] = useMemo(() => {
    if (!activeChainData?.sequence) return [];
    const seq = activeChainData.sequence;
    const chainId = activeChainData.id;

    return seq.split("").map((aa, idx) => {
      const code = aa.toUpperCase();
      const hydropathy = KYTE_DOOLITTLE[code] ?? 0.0;
      let charge: -1 | 0 | 1 = 0;
      if (code === "K" || code === "R") charge = 1;
      else if (code === "D" || code === "E") charge = -1;

      return {
        resi: idx + 1,
        resn: code,
        chain: chainId,
        hydropathy,
        charge,
      };
    });
  }, [activeChainData]);

  // Handle clicking on the 2D SVG Graph
  const handleGraphResidueSelect = (resi: number, chain: string) => {
    setSelectedFeatureKey(`graph-${resi}`);
    setHighlightedResidues({
      chain,
      residues: [resi],
      color: "#22d3ee",
    });
  };

  // Helper trigger to focus the 3D Viewer & Sequence HUD
  const triggerFocus = (key: string, chain: string, residues: number[], color: string) => {
    setSelectedFeatureKey(key);
    setHighlightedResidues({ chain, residues, color });
  };

  if (!pdbId || loading) {
    return (
      <div className="min-h-screen bg-[#05070a] text-white/40 flex items-center justify-center font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <span className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span>INITIALIZING MOLECULAR ENVIRONMENT...</span>
        </div>
      </div>
    );
  }

  const selectedResiNumber =
    highlightedResidues?.residues.length === 1 ? highlightedResidues.residues[0] : null;

  return (
    <div className="min-h-screen bg-[#04070d] text-white flex flex-col">
      {/* Top HUD Status Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-6 bg-[#04070d]/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="font-semibold tracking-[0.3em] text-sm text-white hover:text-cyan-300 transition-colors"
          >
            PROTEUS
          </Link>
          <span className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-xs text-cyan-300 tracking-wider">
              PDB // {pdbId.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          <Link
            to={`/protein/${pdbId}`}
            className="text-white/40 hover:text-white transition-colors"
          >
            ← Raw Structure
          </Link>
        </div>
      </header>

      {/* Main Structural Intelligence Workbench */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">

        {/* ========================================================
            LEFT COLUMN (7 cols): 3D Canvas + Sequence Profiler
           ======================================================== */}
        <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 overflow-hidden">

          {/* 3D Mol Canvas Viewport */}
          <div className="relative flex-1 min-h-[440px] lg:min-h-0 w-full bg-[#020408]">
            <ProteinViewer
              pdbId={pdbId}
              highlightSelection={highlightedResidues}
              forcedChain={selectedChain}
            />

            {/* Scanning Holographic Overlay when AI is Computing */}
            {aiLoading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center font-mono text-xs text-cyan-300 z-20">
                <div className="relative mb-3">
                  <div className="h-10 w-10 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] text-cyan-400">
                    AI
                  </div>
                </div>
                <span className="tracking-[0.2em] animate-pulse">
                  CALCULATING ACTIVE SITES VIA GEMINI...
                </span>
              </div>
            )}

            {/* Subunit Filter Overlay */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur-md p-1 rounded-lg border border-white/10">
              <span className="px-2 font-mono text-[9px] uppercase tracking-wider text-white/40">
                Subunit
              </span>
              <button
                onClick={() => {
                  setSelectedChain("all");
                  setHighlightedResidues(null);
                }}
                className={`px-2 py-0.5 rounded font-mono text-[10px] transition ${
                  selectedChain === "all"
                    ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/40"
                    : "text-white/50 hover:text-white"
                }`}
              >
                ALL
              </button>
              {protein?.chains.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedChain(c.id);
                    setHighlightedResidues(null);
                  }}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] transition ${
                    selectedChain === c.id
                      ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/40"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {c.id}
                </button>
              ))}
            </div>
          </div>

          {/* Sequence Metric Track (Integrated Below 3D View) */}
          <div className="p-4 bg-[#03060c] border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                  Residue Sequence Profiler
                </span>
                {activeChainData && (
                  <span className="font-mono text-[10px] text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">
                    Chain {activeChainData.id} ({sequenceMetrics.length} AA)
                  </span>
                )}
              </div>

              {/* Metric Mode Selectors */}
              <div className="flex gap-1.5 font-mono text-[10px]">
                <button
                  onClick={() => setGraphMetric("hydropathy")}
                  className={`px-2.5 py-1 rounded border transition ${
                    graphMetric === "hydropathy"
                      ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 text-white/40 hover:text-white"
                  }`}
                >
                  Hydropathy
                </button>
                <button
                  onClick={() => setGraphMetric("charge")}
                  className={`px-2.5 py-1 rounded border transition ${
                    graphMetric === "charge"
                      ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 text-white/40 hover:text-white"
                  }`}
                >
                  Charge (pH 7.4)
                </button>
              </div>
            </div>

            {sequenceMetrics.length > 0 ? (
              <SequenceMetricGraph
                data={sequenceMetrics}
                selectedResidue={selectedResiNumber}
                onSelectResidue={handleGraphResidueSelect}
                metricType={graphMetric}
              />
            ) : (
              <div className="p-6 text-center font-mono text-xs text-white/30 border border-white/10 rounded-xl">
                No sequence coordinates available for this chain.
              </div>
            )}
          </div>
        </div>

        {/* ========================================================
            RIGHT COLUMN (5 cols): AI Structural Intelligence Console
           ======================================================== */}
        <div className="lg:col-span-5 flex flex-col bg-[#04070d] h-full overflow-hidden">

          {/* Header Summary Card */}
          <div className="p-6 border-b border-white/10 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Gemini Copilot Readout
              </span>
              <span className="font-mono text-[9px] text-white/30">v2.5 Flash</span>
            </div>
            <h1 className="text-lg font-light text-white leading-snug line-clamp-2">
              {protein?.title || pdbId}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-white/60">
              {result?.summary || "Deconstructing fold topology and coordinates..."}
            </p>
          </div>

          {/* Feature Inspection Tabs */}
          <div className="grid grid-cols-3 border-b border-white/10 font-mono text-xs bg-[#03060c]">
            <button
              onClick={() => setActiveTab("sites")}
              className={`py-3 text-center transition-all border-b-2 ${
                activeTab === "sites"
                  ? "border-rose-400 text-rose-300 bg-rose-400/5 font-semibold"
                  : "border-transparent text-white/40 hover:text-white"
              }`}
            >
              Active Sites ({result?.functionalSites?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("mutations")}
              className={`py-3 text-center transition-all border-b-2 ${
                activeTab === "mutations"
                  ? "border-amber-400 text-amber-300 bg-amber-400/5 font-semibold"
                  : "border-transparent text-white/40 hover:text-white"
              }`}
            >
              $\Delta\Delta G$ Mutants ({result?.pathologyVariants?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("domains")}
              className={`py-3 text-center transition-all border-b-2 ${
                activeTab === "domains"
                  ? "border-violet-400 text-violet-300 bg-violet-400/5 font-semibold"
                  : "border-transparent text-white/40 hover:text-white"
              }`}
            >
              Domains ({result?.domains?.length ?? 0})
            </button>
          </div>

          {/* Interactive Feature List (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
            {aiError && (
              <div className="mx-4 mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-3 font-mono text-[10px] text-red-300">
                {aiError}
              </div>
            )}

            {/* TAB 1: Functional & Catalytic Pockets */}
            {activeTab === "sites" && (
              <>
                {aiLoading ? (
                      <SkeletonCards />
                ): result?.functionalSites && result.functionalSites.length > 0 ? (
                  result.functionalSites.map((site, i) => {
                    const isSelected = selectedFeatureKey === `site-${i}`;
                    return (
                      <div
                        key={i}
                        onClick={() =>
                          triggerFocus(`site-${i}`, site.chain, site.residues, "#f43f5e")
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-rose-400 bg-rose-500/10 shadow-[0_0_25px_-5px_rgba(244,63,94,0.3)]"
                            : "border-white/10 bg-white/[0.02] hover:border-rose-400/40 hover:bg-rose-500/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{site.label}</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-400/10 text-rose-300 border border-rose-400/20">
                            Chain {site.chain}
                          </span>
                        </div>

                        <p className="mt-2 text-xs leading-relaxed text-white/60">
                          {site.description}
                        </p>

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/5">
                          <div className="font-mono text-[10px] text-rose-300/80">
                            Role: {site.chemicalRole}
                          </div>
                          <div className="font-mono text-[10px] text-white/40">
                            Residues: {site.residues.join(", ")}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center font-mono text-xs text-white/30">
                    No catalytic sites identified in this sequence.
                  </div>
                )}
              </>
            )}

            {/* TAB 2: In Silico Mutagenesis & Pathology */}
            {activeTab === "mutations" && (
              <>
                {aiLoading ? (
                      <SkeletonCards />
                    ) : result?.pathologyVariants && result.pathologyVariants.length > 0 ? (
                  result.pathologyVariants.map((mut, i) => {
                    const isSelected = selectedFeatureKey === `mut-${i}`;
                    // const targetChain =
                    //   selectedChain === "all" ? protein?.chains[0]?.id || "A" : selectedChain;

                    return (
                      <div
                        key={i}
                        onClick={() =>
                          triggerFocus(`mut-${i}`, mut.chain, [mut.resi], "#fbbf24")
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-amber-400 bg-amber-500/10 shadow-[0_0_25px_-5px_rgba(251,191,36,0.3)]"
                            : "border-white/10 bg-white/[0.02] hover:border-amber-400/40 hover:bg-amber-500/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-sm font-bold text-amber-300">{mut.mutation}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                            Residue {mut.resi}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-white/40">
                          <span>Significance:</span>
                          <span className="text-white/80">{mut.clinicalSignificance}</span>
                        </div>

                        <p className="mt-2 text-xs leading-relaxed text-white/60">
                          {mut.impact}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center font-mono text-xs text-white/30">
                    No critical point variants analyzed.
                  </div>
                )}
              </>
            )}

            {/* TAB 3: Structural & Folding Domains */}
            {activeTab === "domains" && (
              <>
                {aiLoading ? (
                      <SkeletonCards />
                    ) : result?.domains && result.domains.length > 0 ? (
                  result.domains.map((dom, i) => {
                    const range = Array.from(
                      { length: dom.end - dom.start + 1 },
                      (_, k) => dom.start + k
                    );
                    const isSelected = selectedFeatureKey === `dom-${i}`;
                    const targetChain =
                      selectedChain === "all" ? protein?.chains[0]?.id || "A" : selectedChain;

                    return (
                      <div
                        key={i}
                        onClick={() =>
                          triggerFocus(`dom-${i}`, targetChain, range, "#a78bfa")
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-violet-400 bg-violet-500/10 shadow-[0_0_25px_-5px_rgba(167,139,250,0.3)]"
                            : "border-white/10 bg-white/[0.02] hover:border-violet-400/40 hover:bg-violet-500/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{dom.name}</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-violet-400/10 text-violet-300 border border-violet-400/20">
                            {dom.start} – {dom.end}
                          </span>
                        </div>

                        <p className="mt-2 text-xs leading-relaxed text-white/60">
                          {dom.function}
                        </p>

                        <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-white/40 pt-2 border-t border-white/5">
                          <span>Classification: {dom.type}</span>
                          <span>{range.length} Residues</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center font-mono text-xs text-white/30">
                    No autonomous folding domains classified.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="p-4 border-t border-white/10 bg-[#03060c] flex items-center justify-between">
            <span className="font-mono text-[10px] text-white/30">
              CLICK ITEM TO FOCUS 3D CAMERA
            </span>
            <button
              onClick={() => {
                  if (!protein || !pdbId) return;
                  const chainId = selectedChain === "all" ? protein.chains[0]?.id : selectedChain;
                  const chain = protein.chains.find((c) => c.id === chainId);
                  if (chain) runInsights(pdbId, chain.id, chain.sequence);
                }}
              disabled={aiLoading}
              className="px-3 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 font-mono text-[10px] uppercase tracking-wider hover:bg-cyan-400/20 transition disabled:opacity-40"
            >
              {aiLoading ? "Analyzing..." : "Re-evaluate"}
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
