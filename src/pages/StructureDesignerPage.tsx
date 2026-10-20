import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import AnalysisPanel from "../features/analysis/AnalysisPanel";
import { useStructureDSSP } from "../features/analysis/useStructureDSSP";
import ProteinViewer from "../features/proteins/ProteinViewer";
import PdbUpload from "../features/structure/PdbUpload";
import StructureDesigner, {
  type DesignedChain,
} from "../features/structure/StructureDesigner";
import {
  downloadTextFile,
  parsePdbChains,
  pdbToFile,
} from "../features/structure/pdbUtils";

type Source = "design" | "upload";
type Tab = "structure" | "analysis";

interface Designed {
  pdb: string;
  chains: DesignedChain[];
}

interface Uploaded {
  file: File;
  text: string;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-white/40";

export default function StructureDesignerPage() {
  const [source, setSource] = useState<Source>("design");
  const [tab, setTab] = useState<Tab>("structure");

  const [designed, setDesigned] = useState<Designed | null>(null);
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);

  /* Forces a clean 3D viewer whenever the structure changes. */
  const [structureKey, setStructureKey] = useState(0);

  const [chainChoice, setChainChoice] = useState<Record<Source, string>>({
    design: "",
    upload: "",
  });

  const [selectedResidue, setSelectedResidue] = useState<{
    chain: string;
    residue: number;
  } | null>(null);

  const designDSSP = useStructureDSSP();
  const uploadDSSP = useStructureDSSP();
  const dssp = source === "design" ? designDSSP : uploadDSSP;

  const viewerRef = useRef<HTMLElement>(null);

  const pdbData =
    source === "design" ? designed?.pdb : uploaded?.text;

  const structureChains = useMemo(
    () => (pdbData ? parsePdbChains(pdbData) : []),
    [pdbData],
  );

  const uploadedChains = useMemo(
    () => (uploaded ? parsePdbChains(uploaded.text) : []),
    [uploaded],
  );

  const chainIds = structureChains.map((chain) => chain.id);

  const activeChain = chainIds.includes(chainChoice[source])
    ? chainChoice[source]
    : (chainIds[0] ?? "");

  const activeChainInfo = structureChains.find(
    (chain) => chain.id === activeChain,
  );

  function showNewStructure() {
    setStructureKey((key) => key + 1);
    setSelectedResidue(null);
    setTab("structure");

    // On phones the viewer is below the editor, so bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() =>
        viewerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    }
  }

  function handleGenerated(pdb: string, chains: DesignedChain[]) {
    setDesigned({ pdb, chains });
    designDSSP.reset();
    showNewStructure();
  }

  function handleUpload(file: File, text: string) {
    setUploaded({ file, text });
    uploadDSSP.reset();
    showNewStructure();
  }

  function handleClearUpload() {
    setUploaded(null);
    uploadDSSP.reset();
    setStructureKey((key) => key + 1);
    setSelectedResidue(null);
    setTab("structure");
  }

  function changeSource(next: Source) {
    if (next === source) return;

    setSource(next);
    setStructureKey((key) => key + 1);
    setSelectedResidue(null);
    setTab("structure");
  }

  function runDssp(chains: string[]) {
    const file =
      source === "design"
        ? designed && pdbToFile(designed.pdb)
        : uploaded?.file;

    if (!file || chains.length === 0) return;

    dssp.run(file, chains);
  }

  const hasStructure = Boolean(pdbData);

  const designedStructure =
    source === "design"
      ? designed?.chains.find((chain) => chain.id === activeChain)
          ?.structure
      : undefined;

  return (
    <div className="min-h-screen bg-[#05070a] text-white lg:flex lg:h-screen lg:flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <Link
          to="/"
          className={`rounded text-base font-semibold tracking-[0.25em] sm:text-lg sm:tracking-[0.3em] ${focusRing}`}
        >
          PROTEUS
        </Link>

        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">
          Structure Designer
        </div>
      </header>

      <main className="grid grid-cols-1 lg:min-h-0 lg:flex-1 lg:grid-cols-[400px_1fr] xl:grid-cols-[440px_1fr]">
        {/* Left: build or upload */}
        <aside className="flex min-h-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 p-4">
            <div
              role="group"
              aria-label="Where the structure comes from"
              className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1"
            >
              {(
                [
                  ["design", "Design a protein"],
                  ["upload", "Upload a PDB"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={source === value}
                  onClick={() => changeSource(value)}
                  className={[
                    "rounded-md px-3 py-2 text-xs font-medium transition",
                    focusRing,
                    source === value
                      ? "bg-white text-black"
                      : "text-white/50 hover:text-white",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Both stay mounted so a design isn't lost when switching. */}
          <div
            className={
              source === "design"
                ? "flex min-h-0 flex-1 flex-col"
                : "hidden"
            }
          >
            <StructureDesigner onGenerated={handleGenerated} />
          </div>

          <div
            className={
              source === "upload" ? "p-4 lg:overflow-y-auto" : "hidden"
            }
          >
            <PdbUpload
              file={uploaded?.file ?? null}
              chains={uploadedChains}
              onLoad={handleUpload}
              onClear={handleClearUpload}
            />
          </div>
        </aside>

        {/* Right: 3D view and analysis */}
        <section
          ref={viewerRef}
          className="flex min-h-[75vh] min-w-0 flex-col lg:min-h-0"
        >
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
            <div role="tablist" className="flex gap-1">
              {(
                [
                  ["structure", "3D structure"],
                  ["analysis", "DSSP analysis"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  disabled={!hasStructure}
                  onClick={() => {
                    setTab(value);
                    if (value === "structure") setSelectedResidue(null);
                  }}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-30",
                    focusRing,
                    tab === value
                      ? "bg-white/10 text-white"
                      : "text-white/45 hover:text-white",
                  ].join(" ")}
                >
                  {label}

                  {value === "analysis" && dssp.list.length > 0 && (
                    <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              ))}
            </div>

            {source === "design" && designed && (
              <button
                type="button"
                onClick={() =>
                  downloadTextFile(designed.pdb, "designed.pdb")
                }
                className={`rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/5 hover:text-white ${focusRing}`}
              >
                Download .pdb
              </button>
            )}
          </div>

          <div className="relative min-h-0 flex-1">
            {pdbData ? (
              <div className="absolute inset-0 overflow-hidden">
                <ProteinViewer
                  key={`${source}-${structureKey}`}
                  pdbData={pdbData}
                  dsspResults={dssp.list}
                  selectedResidue={selectedResidue}
                />
              </div>
            ) : (
              <EmptyState source={source} />
            )}

            {tab === "analysis" && hasStructure && (
              <div className="absolute inset-0 z-30 bg-[#05070a]">
                <AnalysisPanel
                  label={
                    source === "design"
                      ? "Designed complex"
                      : uploaded?.file.name
                  }
                  residueCount={activeChainInfo?.residues}
                  chainId={activeChain}
                  chains={chainIds}
                  analyzedChains={Object.keys(dssp.results)}
                  onChainChange={(chain) =>
                    setChainChoice((current) => ({
                      ...current,
                      [source]: chain,
                    }))
                  }
                  onRunAll={() => runDssp(chainIds)}
                  designedStructure={designedStructure}
                  result={dssp.results[activeChain] ?? null}
                  loading={dssp.loading}
                  error={dssp.error}
                  onRunAnalysis={() => runDssp([activeChain])}
                  onResidueSelect={(chain, residue) => {
                    setSelectedResidue({ chain, residue });
                    setTab("structure");
                  }}
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function EmptyState({ source }: { source: Source }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-xs text-center">
        <h2 className="text-sm font-medium text-white/60">
          {source === "design"
            ? "Your structure will appear here"
            : "No file loaded yet"}
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/35">
          {source === "design"
            ? "Shape each chain on the left, then generate it to explore it in 3D and run DSSP."
            : "Upload a .pdb file on the left to view it in 3D and run DSSP on any chain."}
        </p>
      </div>
    </div>
  );
}
