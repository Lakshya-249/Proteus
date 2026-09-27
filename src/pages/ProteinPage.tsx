import {
  useEffect,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import AnalysisPanel from "../features/analysis/AnalysisPanel";

import ProteinViewer, {
  type ResidueInfo,
} from "../features/proteins/ProteinViewer";

import {
  getProteinMetadata,
  type ProteinMetadata,
} from "../features/proteins/pdbApi";

import SequenceViewer from "../features/proteins/SequenceViewer";
import { useProteinAnalysis } from "../features/analysis/useProteinAnalysis";

function ProteinPage() {
  const { pdbId } = useParams();
  const {
    runAnalysis,
    result: analysisResult,
    loading: analysisLoading,
    error: analysisError,
  } = useProteinAnalysis();

  const [activeTab, setActiveTab] = useState<
    "structure" | "sequence" | "analysis"
  >("structure");

  const [residueMap, setResidueMap] =
    useState<Record<string, ResidueInfo[]>>(
      {},
    );

  const [selectedResidue, setSelectedResidue] =
    useState<{
      chain: string;
      residue: number;
    } | null>(null);

  const [protein, setProtein] =
    useState<ProteinMetadata | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // /*
  //  * Keep callback reference stable.
  //  */
  // const handleResidueMap = useCallback(
  //   (map: Record<string, ResidueInfo[]>) => {
  //     setResidueMap(map);
  //   },
  //   [],
  // );

  useEffect(() => {
    if (!pdbId) return;

    async function getProteindata(){
      setLoading(true);
      setError("");
      try {
        getProteinMetadata(pdbId as string)
          .then(setProtein)
          .catch(() => {
            setError(
              "Unable to load protein metadata.",
            );
          })
          .finally(() => {
            setLoading(false);
          });
      } catch (error) {
        console.log(error);
      }
    }

    getProteindata();
  }, [pdbId]);

  if (!pdbId) {
    return (
      <div className="min-h-screen bg-[#05070a] p-6 text-white sm:p-10">
        Invalid protein ID.
      </div>
    );
  }

  const id = pdbId.toUpperCase();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070a] text-white/40">
        <span className="font-mono text-xs">
          LOADING STRUCTURE...
        </span>
      </div>
    );
  }

  if (error || !protein) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070a] p-6 text-white/40">
        <div className="text-center">
          <div className="font-mono text-xs">
            {error}
          </div>

          <a
            href="/"
            className="mt-4 inline-block rounded text-xs text-white/60 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
          >
            ← Return to Proteus
          </a>
        </div>
      </div>
    );
  }

  const totalResidues =
    protein.chains.reduce(
      (total, chain) =>
        total + (chain.length ?? 0),
      0,
    );

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:h-16 sm:py-0 sm:px-6">
        <a
          href="/"
          className="rounded text-base font-semibold tracking-[0.25em] outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:text-lg sm:tracking-[0.3em]"
        >
          PROTEUS
        </a>

        <div className="flex items-center gap-3">
          <div className="font-mono text-xs text-white/40">
            PDB / {id}
          </div>

          <Link
            to={`/protein/${pdbId}/insights`}
            className="flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-cyan-300/80 outline-none transition hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-300/40"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <span className="max-sm:pt-1.5">AI Insights</span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[1fr_340px]">
        {/* Viewer */}
        <section className="relative min-h-[70vh] border-b border-white/10 lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="absolute left-4 top-4 z-10 max-w-[65%] sm:left-6 sm:top-6 sm:max-w-lg">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
              Molecular Structure
            </div>

            <h1 className="mt-2 text-lg font-light leading-tight sm:text-2xl">
              {protein.title}
            </h1>

            <div className="mt-2 font-mono text-xs text-white/30">
              {id}
            </div>
          </div>

          <ProteinViewer
            pdbId={pdbId}
            selectedResidue={selectedResidue}
            onResidueMap={setResidueMap}
            dsspResult={analysisResult}
            // pdbData={pdbData}
          />

          {/* Sequence */}
          {activeTab === "sequence" && (
            <div
              className="absolute inset-x-0 bottom-0 z-30 h-[240px] overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#05070a] shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.6)] sm:h-[280px]"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, rgba(255,255,255,0.03), rgba(255,255,255,0) 40px)",
              }}
            >
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
                  Sequence
                </div>

                <div className="h-1 w-8 rounded-full bg-white/10" />
              </div>

              <div className="h-[calc(100%-2.5rem)] overflow-auto">
                <SequenceViewer
                  chains={protein.chains}
                  residueMap={residueMap}
                  onResidueSelect={(
                    chain,
                    residue,
                  ) => {
                    setSelectedResidue({
                      chain,
                      residue,
                    });
                  }}
                />
              </div>
            </div>
          )}

          {/* Analysis */}
          {activeTab === "analysis" && protein && (
            <div className="absolute inset-0 z-50 bg-[#05070a]">
              <AnalysisPanel
                pdbId={pdbId}
                sequence={protein.chains[0]?.sequence}
                chainId={protein.chains[0]?.id}
                result={analysisResult}
                loading={analysisLoading}
                error={analysisError}
                onRunAnalysis={() => {
                  const chainId =
                    protein.chains[0]?.id;

                  if (!chainId) return;

                  runAnalysis(
                    pdbId,
                    chainId,
                  );
                }}
                onResidueSelect={(chain, residue) => {
                  setSelectedResidue({
                    chain,
                    residue,
                  });

                  setActiveTab("structure");
                }}
              />
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="overflow-y-auto p-4 sm:p-6 lg:max-h-[calc(100vh-4rem)]">
          <div className="mb-8 lg:mb-10">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/30">
              Protein
            </div>

            <h2 className="mt-2 text-2xl font-light sm:text-3xl">
              {id}
            </h2>
          </div>

          <div className="space-y-6 sm:space-y-7">
            <Metadata
              label="CHAINS"
              value={String(
                protein.chains.length,
              )}
            />

            <Metadata
              label="RESIDUES"
              value={
                totalResidues > 0
                  ? totalResidues.toLocaleString()
                  : "—"
              }
            />

            <Metadata
              label="MOLECULAR WEIGHT"
              value={
                protein.molecularWeight
                  ? `${protein.molecularWeight.toFixed(
                      2,
                    )} kDa`
                  : "—"
              }
            />

            <Metadata
              label="METHOD"
              value={protein.method}
            />

            {protein.chains[0]?.organism && (
              <Metadata
                label="ORGANISM"
                value={
                  protein.chains[0].organism
                }
              />
            )}
          </div>

          {/* Chains */}
          <section className="mt-10 border-t border-white/10 pt-6 lg:mt-12">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-white/30">
              Chains
            </div>

            <div className="space-y-2">
              {protein.chains.map((chain) => (
                <div
                  key={`${chain.id}-${chain.name}`}
                  className="flex flex-wrap items-center justify-between gap-2 border border-white/10 px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs">
                      CHAIN {chain.id}
                    </div>

                    {chain.organism && (
                      <div className="mt-1 truncate text-[10px] text-white/30">
                        {chain.organism}
                      </div>
                    )}
                  </div>

                  {chain.length && (
                    <div className="shrink-0 font-mono text-[10px] text-white/30">
                      {chain.length} AA
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Navigation */}
          <nav className="mt-10 border-t border-white/10 pt-6 lg:mt-12">
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  label: "Structure",
                  value: "structure",
                },
                {
                  label: "Sequence",
                  value: "sequence",
                },
                {
                  label: "Analysis",
                  value: "analysis",
                },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    const nextTab =
                      tab.value as
                        | "structure"
                        | "sequence"
                        | "analysis";

                    setActiveTab(nextTab);

                    if (
                      nextTab === "structure"
                    ) {
                      setSelectedResidue(null);
                    }
                  }}
                  className={`border px-2 py-2 font-mono text-[9px] uppercase outline-none transition focus-visible:ring-2 focus-visible:ring-white/40 ${
                    activeTab === tab.value
                      ? "border-white/30 bg-white text-black"
                      : "border-white/10 text-white/30 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        </aside>
      </main>
    </div>
  );
}

interface MetadataProps {
  label: string;
  value: string;
}

function Metadata({
  label,
  value,
}: MetadataProps) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25">
        {label}
      </div>

      <div className="mt-1 text-sm text-white/70">
        {value}
      </div>
    </div>
  );
}

export default ProteinPage;
