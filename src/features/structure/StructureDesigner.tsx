import { useMemo, useState } from "react";

import {
  generateComplexPDB,
  type ComplexChain,
} from "./pdbApi";

type SecondaryStructure = "H" | "E" | "T" | "C";

interface ProteinChain {
  id: string;
  sequence: string;
  structure: SecondaryStructure[];
}

/** What the page needs to know about each chain after generating. */
export interface DesignedChain {
  id: string;
  /** Intended secondary structure, one H / E / T / C per residue. */
  structure: string;
  length: number;
}

interface StructureDesignerProps {
  onGenerated: (pdb: string, chains: DesignedChain[]) => void;
}

type EditMode = "replace" | "insert";

const AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY";

const MAX_CHAINS = 26;

/*
 * Colours match the DSSP colours in the 3D viewer, so what you paint
 * here is what you will later compare against.
 */
const SS_STYLE: Record<
  SecondaryStructure,
  { name: string; dot: string; cell: string; bar: string }
> = {
  H: {
    name: "Helix",
    dot: "bg-cyan-400",
    cell: "bg-cyan-400/10 text-cyan-300",
    bar: "bg-cyan-400/70",
  },
  E: {
    name: "Sheet",
    dot: "bg-violet-400",
    cell: "bg-violet-400/10 text-violet-300",
    bar: "bg-violet-400/70",
  },
  T: {
    name: "Turn",
    dot: "bg-amber-400",
    cell: "bg-amber-400/10 text-amber-300",
    bar: "bg-amber-400/70",
  },
  C: {
    name: "Coil",
    dot: "bg-slate-400",
    cell: "bg-white/[0.04] text-slate-300",
    bar: "bg-slate-400/50",
  },
};

const SS_ORDER: SecondaryStructure[] = ["H", "E", "T", "C"];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-white/40";

const buttonClass = `rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`;

function createStructure(length: number): SecondaryStructure[] {
  return Array.from({ length }, (_, index) =>
    index < length * 0.6 ? "H" : "C",
  );
}

function createChain(id: string): ProteinChain {
  const sequence = id === "A" ? "MKTAAAAAAKG" : "MKKVVAAAAG";

  return {
    id,
    sequence,
    structure: createStructure(sequence.length),
  };
}

/* Accepts plain sequences and pasted FASTA. */
function sanitizeSequence(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(">"))
    .join("")
    .toUpperCase()
    .replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, "");
}

function getNextChainId(chains: ProteinChain[]): string {
  const used = new Set(chains.map((chain) => chain.id));

  for (let code = 65; code <= 90; code++) {
    const id = String.fromCharCode(code);
    if (!used.has(id)) return id;
  }

  return "Z";
}

export default function StructureDesigner({
  onGenerated,
}: StructureDesignerProps) {
  const [chains, setChains] = useState<ProteinChain[]>([
    createChain("A"),
    createChain("B"),
  ]);

  const [activeChainId, setActiveChainId] = useState("A");

  /* Inclusive residue range (0-based) or null. */
  const [range, setRange] = useState<[number, number] | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const [editMode, setEditMode] = useState<EditMode | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generatedSignature, setGeneratedSignature] = useState<
    string | null
  >(null);

  const [error, setError] = useState("");

  const activeChain =
    chains.find((chain) => chain.id === activeChainId) ?? chains[0];

  const totalResidues = useMemo(
    () => chains.reduce((total, chain) => total + chain.sequence.length, 0),
    [chains],
  );

  const structureCounts = useMemo(() => {
    const counts: Record<SecondaryStructure, number> = {
      H: 0,
      E: 0,
      T: 0,
      C: 0,
    };

    for (const chain of chains) {
      for (const state of chain.structure) counts[state]++;
    }

    return counts;
  }, [chains]);

  const signature = JSON.stringify(chains);
  const hasGenerated = generatedSignature !== null;
  const dirty = hasGenerated && generatedSignature !== signature;

  const emptyChain = chains.find((chain) => chain.sequence.length === 0);

  const selectedCount = range ? range[1] - range[0] + 1 : 0;

  function clearSelection() {
    setRange(null);
    setAnchor(null);
    setEditMode(null);
  }

  function updateActiveChain(
    updater: (chain: ProteinChain) => ProteinChain,
  ) {
    setChains((current) =>
      current.map((chain) =>
        chain.id === activeChain.id ? updater(chain) : chain,
      ),
    );
  }

  /* ───────── Chains ───────── */

  function selectChain(id: string) {
    setActiveChainId(id);
    setRenaming(null);
    setConfirmRemove(false);
    clearSelection();
  }

  function addChain() {
    if (chains.length >= MAX_CHAINS) {
      setError(`Maximum of ${MAX_CHAINS} chains reached.`);
      return;
    }

    const chain = createChain(getNextChainId(chains));

    setChains((current) => [...current, chain]);
    selectChain(chain.id);
    setError("");
  }

  function removeActiveChain() {
    if (chains.length === 1) {
      setError("A protein must contain at least one chain.");
      return;
    }

    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }

    const remaining = chains.filter((chain) => chain.id !== activeChain.id);

    setChains(remaining);
    selectChain(remaining[0].id);
    setError("");
  }

  function commitRename() {
    const newId = renaming?.trim().toUpperCase() ?? "";

    if (!/^[A-Z]$/.test(newId)) {
      setError("Chain ID must be one letter, A to Z.");
      return;
    }

    if (newId === activeChain.id) {
      setRenaming(null);
      return;
    }

    if (chains.some((chain) => chain.id === newId)) {
      setError(`Chain ${newId} already exists.`);
      return;
    }

    const oldId = activeChain.id;

    setChains((current) =>
      current.map((chain) =>
        chain.id === oldId ? { ...chain, id: newId } : chain,
      ),
    );

    setActiveChainId(newId);
    setRenaming(null);
    setError("");
  }

  /* ───────── Sequence ───────── */

  function handleSequenceChange(value: string) {
    const sequence = sanitizeSequence(value);

    updateActiveChain((chain) => {
      const structure = chain.structure.slice(0, sequence.length);

      while (structure.length < sequence.length) structure.push("C");

      return { ...chain, sequence, structure };
    });

    clearSelection();
  }

  /* ───────── Selection ───────── */

  function handleResidueDown(index: number, shiftKey: boolean) {
    setEditMode(null);

    if (shiftKey && anchor !== null) {
      setRange([Math.min(anchor, index), Math.max(anchor, index)]);
      return;
    }

    setAnchor(index);
    setDragging(true);
    setRange([index, index]);
  }

  function handleResidueEnter(index: number) {
    if (!dragging || anchor === null) return;

    setRange([Math.min(anchor, index), Math.max(anchor, index)]);
  }

  function stopDragging() {
    setDragging(false);
  }

  function selectAll() {
    if (!activeChain.sequence.length) return;

    setAnchor(0);
    setRange([0, activeChain.sequence.length - 1]);
    setEditMode(null);
  }

  /* ───────── Edits ───────── */

  function assignStructure(type: SecondaryStructure) {
    if (!range) return;

    const [start, end] = range;

    updateActiveChain((chain) => ({
      ...chain,
      structure: chain.structure.map((state, index) =>
        index >= start && index <= end ? type : state,
      ),
    }));
  }

  function applyAminoAcid(aa: string) {
    if (editMode === "replace" && range) {
      const [start, end] = range;

      updateActiveChain((chain) => ({
        ...chain,
        sequence:
          chain.sequence.slice(0, start) +
          aa.repeat(end - start + 1) +
          chain.sequence.slice(end + 1),
      }));
    }

    if (editMode === "insert") {
      const index = range ? range[0] : activeChain.sequence.length;

      updateActiveChain((chain) => ({
        ...chain,
        sequence:
          chain.sequence.slice(0, index) + aa + chain.sequence.slice(index),
        structure: [
          ...chain.structure.slice(0, index),
          "C",
          ...chain.structure.slice(index),
        ],
      }));

      setAnchor(index);
      setRange([index, index]);
    }

    setEditMode(null);
    setError("");
  }

  function deleteSelection() {
    if (!range) return;

    const [start, end] = range;

    updateActiveChain((chain) => ({
      ...chain,
      sequence: chain.sequence.slice(0, start) + chain.sequence.slice(end + 1),
      structure: chain.structure.filter(
        (_, index) => index < start || index > end,
      ),
    }));

    clearSelection();
  }

  /* ───────── Generate ───────── */

  async function generateComplex() {
    setGenerating(true);
    setError("");

    try {
      const payload: ComplexChain[] = chains.map((chain) => ({
        id: chain.id,
        sequence: chain.sequence,
        structure: chain.structure.join(""),
      }));

      const pdb = await generateComplexPDB(payload);

      setGeneratedSignature(signature);

      onGenerated(
        pdb,
        chains.map((chain) => ({
          id: chain.id,
          structure: chain.structure.join(""),
          length: chain.sequence.length,
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate complex.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const footerHint = emptyChain
    ? `Chain ${emptyChain.id} has no residues yet.`
    : dirty
      ? "You have changes that are not in the 3D view yet."
      : `${chains.length} ${chains.length === 1 ? "chain" : "chains"} · ${totalResidues} residues`;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onMouseUp={stopDragging}
    >
      <div className="min-h-0 flex-1 space-y-4 p-4 lg:overflow-y-auto">
        {/* Chains */}
        <section aria-label="Chains">
          <div className="flex flex-wrap items-center gap-2">
            {chains.map((chain) => {
              const active = chain.id === activeChain.id;

              return (
                <button
                  key={chain.id}
                  type="button"
                  onClick={() => selectChain(chain.id)}
                  aria-pressed={active}
                  className={[
                    "flex items-center gap-2 rounded-md border px-3 py-1.5 transition",
                    focusRing,
                    active
                      ? "border-white/30 bg-white/[0.08] text-white"
                      : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  <span className="font-mono text-sm font-semibold">
                    {chain.id}
                  </span>

                  <span className="font-mono text-[10px] text-white/35">
                    {chain.sequence.length}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={addChain}
              aria-label="Add chain"
              title="Add chain"
              className={`rounded-md border border-dashed border-white/15 px-3 py-1.5 font-mono text-sm text-white/40 transition hover:border-white/30 hover:text-white ${focusRing}`}
            >
              +
            </button>
          </div>
        </section>

        {/* Active chain */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            {renaming === null ? (
              <div className="text-sm font-medium">
                Chain {activeChain.id}
                <span className="ml-2 font-mono text-[10px] font-normal text-white/30">
                  {activeChain.sequence.length} aa
                </span>
              </div>
            ) : (
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  commitRename();
                }}
              >
                <label className="sr-only" htmlFor="chain-id">
                  New chain ID
                </label>

                <input
                  id="chain-id"
                  autoFocus
                  value={renaming}
                  maxLength={1}
                  onChange={(event) => setRenaming(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setRenaming(null);
                  }}
                  className={`h-8 w-10 rounded-md border border-white/20 bg-black/30 text-center font-mono text-sm uppercase ${focusRing}`}
                />

                <button type="submit" className={buttonClass}>
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => setRenaming(null)}
                  className={buttonClass}
                >
                  Cancel
                </button>
              </form>
            )}

            {renaming === null && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(activeChain.id);
                    setConfirmRemove(false);
                  }}
                  className={buttonClass}
                >
                  Rename
                </button>

                <button
                  type="button"
                  onClick={removeActiveChain}
                  onBlur={() => setConfirmRemove(false)}
                  disabled={chains.length === 1}
                  className={`rounded-md border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-30 ${focusRing} ${
                    confirmRemove
                      ? "border-red-400/40 bg-red-400/10 text-red-300"
                      : "border-white/10 text-white/60 hover:bg-white/5 hover:text-red-300"
                  }`}
                >
                  {confirmRemove ? "Confirm remove" : "Remove"}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 p-4">
            {/* Sequence */}
            <div>
              <label
                htmlFor="sequence"
                className="mb-1.5 block text-xs text-white/45"
              >
                Sequence
              </label>

              <textarea
                id="sequence"
                value={activeChain.sequence}
                onChange={(event) =>
                  handleSequenceChange(event.target.value)
                }
                spellCheck={false}
                rows={2}
                placeholder="Type or paste amino acids (FASTA is fine)"
                className={`w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-sm leading-6 text-white transition placeholder:text-white/20 focus:border-white/30 ${focusRing}`}
              />
            </div>

            {/* Residue map */}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs text-white/45">
                  Structure
                </span>

                <span className="text-[11px] text-white/30">
                  Drag to select · Shift-click extends
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20">
                {activeChain.sequence.length === 0 ? (
                  <div className="p-4 text-xs text-white/30">
                    Add a sequence to start shaping its structure.
                  </div>
                ) : (
                  <div
                    className="flex min-w-max select-none px-2 py-2"
                    onMouseLeave={stopDragging}
                  >
                    {activeChain.sequence.split("").map((aa, index) => {
                      const selected =
                        range !== null &&
                        index >= range[0] &&
                        index <= range[1];

                      const type = activeChain.structure[index];

                      return (
                        <div
                          key={index}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleResidueDown(index, event.shiftKey);
                          }}
                          onMouseEnter={() => handleResidueEnter(index)}
                          className="w-7 shrink-0 cursor-pointer"
                        >
                          <div className="h-3 text-center font-mono text-[8px] leading-3 text-white/25">
                            {(index + 1) % 10 === 0 ? index + 1 : ""}
                          </div>

                          <button
                            type="button"
                            aria-label={`Residue ${index + 1}, ${aa}`}
                            aria-pressed={selected}
                            onClick={(event) => {
                              // Keyboard activation only; the mouse is
                              // handled on mousedown.
                              if (event.detail === 0) {
                                handleResidueDown(index, event.shiftKey);
                                stopDragging();
                              }
                            }}
                            className={[
                              "flex h-8 w-full items-center justify-center font-mono text-xs transition",
                              focusRing,
                              selected
                                ? "bg-white text-black"
                                : "text-white/75 hover:bg-white/10",
                            ].join(" ")}
                          >
                            {aa}
                          </button>

                          <div
                            aria-hidden="true"
                            className={[
                              "mt-0.5 flex h-6 items-center justify-center font-mono text-[10px]",
                              selected
                                ? "bg-white text-black"
                                : SS_STYLE[type].cell,
                            ].join(" ")}
                          >
                            {type}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Selection toolbar */}
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-white/50">
                  {range ? (
                    <>
                      {selectedCount === 1
                        ? `Residue ${range[0] + 1}`
                        : `Residues ${range[0] + 1}–${range[1] + 1}`}
                      <span className="ml-2 text-white/30">
                        {selectedCount} selected
                      </span>
                    </>
                  ) : (
                    "Select residues to edit them"
                  )}
                </div>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={selectAll}
                    disabled={activeChain.sequence.length === 0}
                    className={buttonClass}
                  >
                    Select all
                  </button>

                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={!range}
                    className={buttonClass}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Paint secondary structure */}
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] text-white/35">
                  Paint selection as
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {SS_ORDER.map((type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={!range}
                      onClick={() => assignStructure(type)}
                      className={`flex items-center justify-center gap-1.5 rounded-md border border-white/10 px-2 py-2 text-xs text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${SS_STYLE[type].dot}`}
                      />
                      {SS_STYLE[type].name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edit residues */}
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  disabled={!range}
                  aria-expanded={editMode === "replace"}
                  onClick={() =>
                    setEditMode(editMode === "replace" ? null : "replace")
                  }
                  className={`${buttonClass} ${editMode === "replace" ? "bg-white/10 text-white" : ""}`}
                >
                  Replace
                </button>

                <button
                  type="button"
                  aria-expanded={editMode === "insert"}
                  onClick={() =>
                    setEditMode(editMode === "insert" ? null : "insert")
                  }
                  className={`${buttonClass} ${editMode === "insert" ? "bg-white/10 text-white" : ""}`}
                >
                  Insert
                </button>

                <button
                  type="button"
                  disabled={!range}
                  onClick={deleteSelection}
                  className={buttonClass}
                >
                  Delete
                </button>
              </div>

              {editMode && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="mb-2 text-[11px] text-white/40">
                    {editMode === "replace"
                      ? `Replace ${selectedCount === 1 ? "residue" : `${selectedCount} residues`} with…`
                      : range
                        ? `Insert before residue ${range[0] + 1}…`
                        : "Insert at the end of the chain…"}
                  </div>

                  <div className="grid grid-cols-10 gap-1">
                    {AMINO_ACIDS.split("").map((aa) => (
                      <button
                        key={aa}
                        type="button"
                        onClick={() => applyAminoAcid(aa)}
                        className={`flex h-8 items-center justify-center rounded border border-white/10 font-mono text-xs text-white/70 transition hover:bg-white hover:text-black ${focusRing}`}
                      >
                        {aa}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Composition */}
        <section aria-label="Complex composition">
          <div className="mb-2 text-xs text-white/45">
            Whole complex
          </div>

          <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
            {SS_ORDER.map((type) =>
              structureCounts[type] > 0 ? (
                <div
                  key={type}
                  className={SS_STYLE[type].bar}
                  style={{
                    width: `${(structureCounts[type] / Math.max(totalResidues, 1)) * 100}%`,
                  }}
                />
              ) : null,
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {SS_ORDER.map((type) => (
              <div
                key={type}
                className="flex items-center gap-1.5 text-[11px] text-white/45"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${SS_STYLE[type].dot}`}
                />

                {SS_STYLE[type].name}

                <span className="font-mono text-white/70">
                  {structureCounts[type]}
                </span>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-xs leading-5 text-red-300"
          >
            {error}
          </div>
        )}
      </div>

      {/* Generate */}
      <footer className="sticky bottom-0 border-t border-white/10 bg-[#05070a] px-4 py-3">
        <button
          type="button"
          disabled={generating || Boolean(emptyChain)}
          onClick={generateComplex}
          className={`w-full rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
        >
          {generating
            ? "Generating…"
            : hasGenerated && dirty
              ? "Update 3D structure"
              : chains.length === 1
                ? "Generate structure"
                : `Generate ${chains.length}-chain complex`}
        </button>

        <div
          className={`mt-2 text-center text-[11px] ${dirty ? "text-amber-300/80" : "text-white/30"}`}
        >
          {footerHint}
        </div>
      </footer>
    </div>
  );
}
