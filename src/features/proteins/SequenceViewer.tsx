import { useState } from "react";

interface SequenceViewerProps {
  chains: {
    id: string;
    sequence?: string;
    length?: number;
  }[];

  residueMap: Record<
    string,
    {
      resi: number;
      resn: string;
    }[]
  >;

  onResidueSelect?: (
    chain: string,
    residue: number,
  ) => void;
}

function SequenceViewer({
  chains,
  residueMap,
  onResidueSelect,
}: SequenceViewerProps) {
  const [selectedChain, setSelectedChain] =
    useState(
      chains[0]?.id ?? "",
    );

  const chain = chains.find(
    (item) =>
      item.id === selectedChain,
  );

  if (!chain?.sequence) {
    return (
      <div className="p-6 font-mono text-xs text-white/30">
        No sequence available.
      </div>
    );
  }

  const sequence = chain.sequence.replace(
    /\s/g,
    "",
  );

  const residues = sequence.split("");

  const pdbResidues =
    residueMap[selectedChain] ?? [];

  return (
    <div className="h-full overflow-auto p-6">
      {/* Chain selector */}
      <div className="mb-8 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
          Chain
        </span>

        {chains.map((item) => (
          <button
            key={item.id}
            onClick={() =>
              setSelectedChain(item.id)
            }
            className={`px-3 py-1 font-mono text-xs ${
              selectedChain === item.id
                ? "bg-white text-black"
                : "border border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {item.id}
          </button>
        ))}
      </div>

      {/* Sequence */}
      <div className="font-mono">
        <div className="mb-3 text-[10px] uppercase tracking-widest text-white/25">
          Primary Sequence
        </div>

        <div className="max-w-4xl border-y border-white/10 py-5">
          <div className="flex flex-wrap gap-1">
            {residues.map(
              (residue, index) => {
                const sequencePosition =
                  index + 1;

                /*
                 * Map sequence position to
                 * actual PDB residue.
                 */
                const pdbResidue =
                  pdbResidues[index];

                const clickable =
                  pdbResidue != null;

                return (
                  <button
                    key={`${residue}-${index}`}
                    disabled={!clickable}
                    onClick={() => {
                      if (!pdbResidue) {
                        return;
                      }

                      console.log(
                        "SEQUENCE CLICK:",
                        selectedChain,
                        "sequence:",
                        sequencePosition,
                        "PDB resi:",
                        pdbResidue.resi,
                      );

                      onResidueSelect?.(
                        selectedChain,
                        pdbResidue.resi,
                      );
                    }}
                    title={
                      clickable
                        ? `Sequence ${sequencePosition} → PDB ${pdbResidue.resi}`
                        : `Sequence ${sequencePosition} — not present in structure`
                    }
                    className={`group relative flex h-8 w-7 items-center justify-center text-xs transition ${
                      clickable
                        ? "text-white/50 hover:bg-white hover:text-black"
                        : "cursor-not-allowed text-white/10"
                    }`}
                  >
                    {residue}

                    {sequencePosition %
                      10 ===
                      0 && (
                      <span className="absolute -bottom-4 text-[8px] text-white/20">
                        {sequencePosition}
                      </span>
                    )}
                  </button>
                );
              },
            )}
          </div>
        </div>

        <div className="mt-8 text-[10px] text-white/20">
          {sequence.length} residues
        </div>

        <div className="mt-2 text-[9px] text-white/15">
          STRUCTURE RESIDUES:{" "}
          {pdbResidues.length}
        </div>
      </div>
    </div>
  );
}

export default SequenceViewer;
