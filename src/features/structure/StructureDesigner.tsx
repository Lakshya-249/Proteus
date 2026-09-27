import {
  useMemo,
  useState,
} from "react";

import {
  generateComplexPDB,
  type ComplexChain,
} from "./pdbApi";


type SecondaryStructure =
  | "H"
  | "E"
  | "C"
  | "T";


interface ProteinChain {
  id: string;
  sequence: string;
  structure: SecondaryStructure[];
}


interface StructureDesignerProps {
  onGenerated: (pdb: string) => void;
}


const AMINO_ACIDS =
  "ACDEFGHIKLMNPQRSTVWY";


const STRUCTURE_INFO: Record<
  SecondaryStructure,
  {
    label: string;
    description: string;
  }
> = {
  H: {
    label: "HELIX",
    description: "Alpha helix",
  },

  E: {
    label: "SHEET",
    description: "Beta strand",
  },

  C: {
    label: "COIL",
    description: "Coil",
  },

  T: {
    label: "TURN",
    description: "Turn",
  },
};


function createStructure(
  length: number,
): SecondaryStructure[] {
  return Array.from(
    { length },
    (_, index) => {
      if (index < length * 0.6) {
        return "H";
      }

      return "C";
    },
  );
}


function createChain(
  id: string,
): ProteinChain {
  const sequence =
    id === "A"
      ? "MKTAAAAAAKG"
      : "MKKVVAAAAG";

  return {
    id,
    sequence,
    structure: createStructure(
      sequence.length,
    ),
  };
}


function sanitizeSequence(
  value: string,
): string {
  return value
    .toUpperCase()
    .replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, "");
}


function getNextChainId(
  chains: ProteinChain[],
): string {
  const used = new Set(
    chains.map((chain) => chain.id),
  );

  for (
    let code = 65;
    code <= 90;
    code++
  ) {
    const id =
      String.fromCharCode(code);

    if (!used.has(id)) {
      return id;
    }
  }

  return "Z";
}


export default function StructureDesigner({
  onGenerated,
}: StructureDesignerProps) {
  const [chains, setChains] =
    useState<ProteinChain[]>([
      createChain("A"),
      createChain("B"),
    ]);

  const [activeChainId, setActiveChainId] =
    useState("A");

  const [selectedResidues, setSelectedResidues] =
    useState<number[]>([]);

  const [dragStart, setDragStart] =
    useState<number | null>(null);

  const [dragging, setDragging] =
    useState(false);

  const [generating, setGenerating] =
    useState(false);

  const [error, setError] =
    useState("");

  const activeChain =
    chains.find(
      (chain) =>
        chain.id === activeChainId,
    ) ?? chains[0];


  const selectedSet = useMemo(
    () =>
      new Set(selectedResidues),
    [selectedResidues],
  );


  const totalResidues = useMemo(
    () =>
      chains.reduce(
        (total, chain) =>
          total + chain.sequence.length,
        0,
      ),
    [chains],
  );


  const structureCounts =
    useMemo(() => {
      const counts = {
        H: 0,
        E: 0,
        C: 0,
        T: 0,
      };

      for (const chain of chains) {
        for (const state of chain.structure) {
          counts[state]++;
        }
      }

      return counts;
    }, [chains]);


  function updateActiveChain(
    updater: (
      chain: ProteinChain,
    ) => ProteinChain,
  ) {
    setChains((current) =>
      current.map((chain) =>
        chain.id === activeChain.id
          ? updater(chain)
          : chain,
      ),
    );
  }


  function addChain() {
    if (chains.length >= 26) {
      setError(
        "Maximum of 26 chains reached.",
      );

      return;
    }

    const id = getNextChainId(chains);

    const chain = createChain(id);

    setChains((current) => [
      ...current,
      chain,
    ]);

    setActiveChainId(id);
    setSelectedResidues([]);
    setError("");
  }


  function removeChain(id: string) {
    if (chains.length === 1) {
      setError(
        "A protein must contain at least one chain.",
      );

      return;
    }

    const remaining =
      chains.filter(
        (chain) => chain.id !== id,
      );

    setChains(remaining);

    if (activeChainId === id) {
      setActiveChainId(
        remaining[0].id,
      );
    }

    setSelectedResidues([]);
  }


  function renameChain(
    oldId: string,
  ) {
    const newId =
      window.prompt(
        "New chain ID",
        oldId,
      )
        ?.trim()
        .toUpperCase();

    if (!newId) {
      return;
    }

    if (
      newId.length !== 1 ||
      !/^[A-Z]$/.test(newId)
    ) {
      setError(
        "Chain ID must be one letter A-Z.",
      );

      return;
    }

    if (
      chains.some(
        (chain) =>
          chain.id === newId &&
          chain.id !== oldId,
      )
    ) {
      setError(
        `Chain ${newId} already exists.`,
      );

      return;
    }

    setChains((current) =>
      current.map((chain) =>
        chain.id === oldId
          ? {
              ...chain,
              id: newId,
            }
          : chain,
      ),
    );

    if (activeChainId === oldId) {
      setActiveChainId(newId);
    }

    setError("");
  }


  function handleSequenceChange(
    value: string,
  ) {
    const sequence =
      sanitizeSequence(value);

    updateActiveChain(
      (chain) => {
        const nextStructure =
          chain.structure.slice(
            0,
            sequence.length,
          );

        while (
          nextStructure.length <
          sequence.length
        ) {
          nextStructure.push("C");
        }

        return {
          ...chain,
          sequence,
          structure: nextStructure,
        };
      },
    );

    setSelectedResidues([]);
  }


  function selectResidue(
    index: number,
    shiftKey: boolean,
  ) {
    if (shiftKey && selectedResidues.length) {
      const first =
        selectedResidues[0];

      const start = Math.min(
        first,
        index,
      );

      const end = Math.max(
        first,
        index,
      );

      const range = Array.from(
        {
          length:
            end - start + 1,
        },
        (_, offset) =>
          start + offset,
      );

      setSelectedResidues(range);

      return;
    }

    setSelectedResidues([index]);
  }


  function handleResidueMouseDown(
    index: number,
  ) {
    setDragStart(index);
    setDragging(true);
    setSelectedResidues([index]);
  }


  function handleResidueMouseEnter(
    index: number,
  ) {
    if (
      !dragging ||
      dragStart === null
    ) {
      return;
    }

    const start = Math.min(
      dragStart,
      index,
    );

    const end = Math.max(
      dragStart,
      index,
    );

    setSelectedResidues(
      Array.from(
        {
          length:
            end - start + 1,
        },
        (_, offset) =>
          start + offset,
      ),
    );
  }


  function finishDragging() {
    setDragging(false);
    setDragStart(null);
  }


  function assignStructure(
    type: SecondaryStructure,
  ) {
    if (!selectedResidues.length) {
      return;
    }

    updateActiveChain(
      (chain) => {
        const structure =
          [...chain.structure];

        for (const index of selectedResidues) {
          structure[index] = type;
        }

        return {
          ...chain,
          structure,
        };
      },
    );
  }


  function replaceSelectedResidues() {
    if (!selectedResidues.length) {
      return;
    }

    const aa =
      window.prompt(
        "Replace selected residues with amino acid",
        "A",
      )
        ?.trim()
        .toUpperCase();

    if (!aa) {
      return;
    }

    if (
      aa.length !== 1 ||
      !AMINO_ACIDS.includes(aa)
    ) {
      setError(
        "Enter one valid amino acid.",
      );

      return;
    }

    updateActiveChain(
      (chain) => {
        const sequence =
          chain.sequence.split("");

        for (const index of selectedResidues) {
          sequence[index] = aa;
        }

        return {
          ...chain,
          sequence:
            sequence.join(""),
        };
      },
    );

    setError("");
  }


  function deleteSelectedResidues() {
    if (!selectedResidues.length) {
      return;
    }

    const selected =
      new Set(selectedResidues);

    updateActiveChain(
      (chain) => {
        const sequence: string[] = [];
        const structure: SecondaryStructure[] =
          [];

        for (
          let index = 0;
          index < chain.sequence.length;
          index++
        ) {
          if (selected.has(index)) {
            continue;
          }

          sequence.push(
            chain.sequence[index],
          );

          structure.push(
            chain.structure[index],
          );
        }

        return {
          ...chain,
          sequence:
            sequence.join(""),
          structure,
        };
      },
    );

    setSelectedResidues([]);
  }


  function insertResidue() {
    const positionText =
      window.prompt(
        `Insert before residue (1-${activeChain.sequence.length + 1})`,
        String(
          activeChain.sequence.length + 1,
        ),
      );

    if (!positionText) {
      return;
    }

    const position =
      Number(positionText);

    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position >
        activeChain.sequence.length + 1
    ) {
      setError(
        "Invalid insertion position.",
      );

      return;
    }

    const aa =
      window.prompt(
        "Amino acid",
        "A",
      )
        ?.trim()
        .toUpperCase();

    if (!aa) {
      return;
    }

    if (
      aa.length !== 1 ||
      !AMINO_ACIDS.includes(aa)
    ) {
      setError(
        "Enter one valid amino acid.",
      );

      return;
    }

    const index = position - 1;

    updateActiveChain(
      (chain) => ({
        ...chain,
        sequence:
          chain.sequence.slice(
            0,
            index,
          ) +
          aa +
          chain.sequence.slice(index),

        structure: [
          ...chain.structure.slice(
            0,
            index,
          ),
          "C",
          ...chain.structure.slice(index),
        ],
      }),
    );

    setError("");
  }


  async function generateComplex() {
    setGenerating(true);
    setError("");

    try {
      const payload: ComplexChain[] =
        chains.map((chain) => ({
          id: chain.id,
          sequence: chain.sequence,
          structure:
            chain.structure.join(""),
        }));

      const pdb =
        await generateComplexPDB(
          payload,
        );

      onGenerated(pdb);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate complex.",
      );
    } finally {
      setGenerating(false);
    }
  }


  return (
    <div
      className="space-y-6"
      onMouseUp={finishDragging}
    >
      {/* HEADER */}

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
          Structure Architect
        </div>

        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
          Multi-chain Protein
        </h1>

        <p className="mt-2 text-sm leading-6 text-white/40">
          Construct multiple protein chains
          and generate them as one molecular
          complex.
        </p>
      </div>


      {/* COMPLEX SUMMARY */}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-white/30">
            Chains
          </div>

          <div className="mt-1 text-lg font-semibold sm:text-xl">
            {chains.length}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-white/30">
            Residues
          </div>

          <div className="mt-1 text-lg font-semibold sm:text-xl">
            {totalResidues}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-white/30">
            Mode
          </div>

          <div className="mt-1 text-lg font-semibold sm:text-xl">
            Complex
          </div>
        </div>
      </div>


      {/* CHAIN MANAGER */}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
            Chains
          </div>

          <button
            type="button"
            onClick={addChain}
            className="rounded-md border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/60 outline-none transition hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
          >
            + Add Chain
          </button>
        </div>

        <div className="space-y-2">
          {chains.map((chain) => {
            const active =
              chain.id ===
              activeChainId;

            return (
              <button
                key={chain.id}
                type="button"
                onClick={() => {
                  setActiveChainId(
                    chain.id,
                  );
                  setSelectedResidues([]);
                }}
                className={[
                  "w-full rounded-lg border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-white/40",
                  active
                    ? "border-white/30 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 font-mono text-sm font-bold">
                      {chain.id}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        Chain {chain.id}
                      </div>

                      <div className="font-mono text-[10px] text-white/30">
                        {chain.sequence.length} residues
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded border border-white/10 px-2 py-1 font-mono text-[9px] text-white/40">
                      {chain.structure.filter(
                        (x) => x === "H",
                      ).length}
                      H
                    </span>

                    <span className="rounded border border-white/10 px-2 py-1 font-mono text-[9px] text-white/40">
                      {chain.structure.filter(
                        (x) => x === "E",
                      ).length}
                      E
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>


      {/* ACTIVE CHAIN */}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
              Active Chain
            </div>

            <div className="mt-1 text-lg font-semibold">
              Chain {activeChain.id}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              renameChain(
                activeChain.id,
              )
            }
            className="rounded-md border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white/50 outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Rename
          </button>
        </div>


        {/* SEQUENCE */}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">
              Sequence
            </span>

            <span className="font-mono text-[9px] text-white/20">
              {activeChain.sequence.length} aa
            </span>
          </div>

          <textarea
            value={activeChain.sequence}
            onChange={(event) =>
              handleSequenceChange(
                event.target.value,
              )
            }
            spellCheck={false}
            rows={4}
            className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-sm leading-6 text-white outline-none transition placeholder:text-white/20 focus:border-white/30 focus-visible:ring-2 focus-visible:ring-white/40"
            placeholder="Enter amino acid sequence..."
          />
        </div>


        {/* TOOLBAR */}

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              "H",
              "E",
              "C",
              "T",
            ] as SecondaryStructure[]
          ).map((type) => (
            <button
              key={type}
              type="button"
              disabled={
                selectedResidues.length === 0
              }
              onClick={() =>
                assignStructure(type)
              }
              className="rounded-md border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white/60 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {type} ·{" "}
              {STRUCTURE_INFO[type].label}
            </button>
          ))}
        </div>


        {/* STRUCTURE MAP */}

        <div className="mt-4 overflow-x-auto rounded-lg border border-white/10 bg-black/20">
          <div
            className="min-w-max p-3"
            onMouseLeave={
              finishDragging
            }
          >
            <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-white/20">
              Residue map
            </div>

            <div className="flex">
              {activeChain.sequence
                .split("")
                .map((_, index) => (
                  <div
                    key={`number-${index}`}
                    className="w-7 text-center font-mono text-[8px] text-white/20"
                  >
                    {(index + 1) % 10 === 0
                      ? index + 1
                      : ""}
                  </div>
                ))}
            </div>


            {/* SEQUENCE ROW */}

            <div className="mt-1 flex">
              {activeChain.sequence
                .split("")
                .map((aa, index) => {
                  const selected =
                    selectedSet.has(
                      index,
                    );

                  return (
                    <button
                      key={`aa-${index}`}
                      type="button"
                      onClick={(event) =>
                        selectResidue(
                          index,
                          event.shiftKey,
                        )
                      }
                      onMouseDown={() =>
                        handleResidueMouseDown(
                          index,
                        )
                      }
                      onMouseEnter={() =>
                        handleResidueMouseEnter(
                          index,
                        )
                      }
                      className={[
                        "flex h-8 w-7 shrink-0 items-center justify-center font-mono text-xs outline-none transition focus-visible:ring-2 focus-visible:ring-white/40",
                        selected
                          ? "bg-white text-black"
                          : "text-white/70 hover:bg-white/10",
                      ].join(" ")}
                    >
                      {aa}
                    </button>
                  );
                })}
            </div>


            {/* STRUCTURE ROW */}

            <div className="mt-1 flex border-t border-white/5 pt-1">
              {activeChain.structure.map(
                (type, index) => {
                  const selected =
                    selectedSet.has(
                      index,
                    );

                  return (
                    <button
                      key={`ss-${index}`}
                      type="button"
                      onClick={() =>
                        selectResidue(
                          index,
                          false,
                        )
                      }
                      className={[
                        "flex h-7 w-7 shrink-0 items-center justify-center font-mono text-[9px] outline-none transition focus-visible:ring-2 focus-visible:ring-white/40",
                        selected
                          ? "bg-white text-black"
                          : "text-white/40 hover:bg-white/10",
                      ].join(" ")}
                    >
                      {type}
                    </button>
                  );
                },
              )}
            </div>


            {/* STRUCTURE BAR */}

            <div className="mt-2 flex h-2 overflow-hidden rounded-full">
              {activeChain.structure.map(
                (type, index) => (
                  <div
                    key={`bar-${index}`}
                    className={[
                      "h-full w-7 shrink-0 border-r border-black/20",
                      type === "H"
                        ? "bg-white/80"
                        : type === "E"
                          ? "bg-white/55"
                          : type === "T"
                            ? "bg-white/35"
                            : "bg-white/15",
                    ].join(" ")}
                  />
                ),
              )}
            </div>
          </div>
        </div>


        {/* EDIT OPERATIONS */}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={
              replaceSelectedResidues
            }
            disabled={
              selectedResidues.length === 0
            }
            className="rounded-md border border-white/10 px-2 py-2 font-mono text-[9px] uppercase tracking-widest text-white/50 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-30 sm:px-3"
          >
            Replace
          </button>

          <button
            type="button"
            onClick={
              insertResidue
            }
            className="rounded-md border border-white/10 px-2 py-2 font-mono text-[9px] uppercase tracking-widest text-white/50 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40 sm:px-3"
          >
            Insert
          </button>

          <button
            type="button"
            onClick={
              deleteSelectedResidues
            }
            disabled={
              selectedResidues.length === 0
            }
            className="rounded-md border border-white/10 px-2 py-2 font-mono text-[9px] uppercase tracking-widest text-white/50 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-30 sm:px-3"
          >
            Delete
          </button>
        </div>


        {/* SELECTION INFO */}

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">
              Selection
            </span>

            <span className="font-mono text-xs text-white/60">
              {selectedResidues.length}
            </span>
          </div>

          {selectedResidues.length > 0 && (
            <div className="mt-2 font-mono text-[10px] text-white/30">
              Residues{" "}
              {selectedResidues
                .map(
                  (index) =>
                    index + 1,
                )
                .join(", ")}
            </div>
          )}
        </div>
      </section>


      {/* GLOBAL STRUCTURE SUMMARY */}

      <section>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          Complex composition
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["H", "Helix"],
              ["E", "Sheet"],
              ["C", "Coil"],
              ["T", "Turn"],
            ] as const
          ).map(([type, label]) => (
            <div
              key={type}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-2"
            >
              <div className="font-mono text-[9px] text-white/25">
                {label}
              </div>

              <div className="mt-1 font-mono text-sm text-white/70">
                {structureCounts[type]}
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* DELETE CHAIN */}

      <button
        type="button"
        onClick={() =>
          removeChain(
            activeChain.id,
          )
        }
        disabled={chains.length === 1}
        className="w-full rounded-lg border border-red-500/20 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-red-300/60 outline-none transition hover:bg-red-500/5 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-400/40 disabled:cursor-not-allowed disabled:opacity-20"
      >
        Remove Chain {activeChain.id}
      </button>


      {/* ERROR */}

      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 font-mono text-[10px] leading-5 text-red-300">
          {error}
        </div>
      )}


      {/* GENERATE */}

      <button
        type="button"
        disabled={
          generating ||
          chains.some(
            (chain) =>
              chain.sequence.length === 0,
          )
        }
        onClick={
          generateComplex
        }
        className="sticky bottom-4 w-full rounded-xl border border-white/20 bg-white px-5 py-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-black shadow-2xl outline-none transition hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {generating
          ? "Generating Complex..."
          : `Generate ${chains.length}-Chain Complex`}
      </button>
    </div>
  );
}
