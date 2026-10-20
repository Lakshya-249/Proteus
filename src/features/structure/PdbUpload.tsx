import { useRef, useState, type DragEvent } from "react";

import {
  MAX_PDB_BYTES,
  formatBytes,
  pdbToFile,
  validatePdbFile,
  type PdbChainInfo,
} from "./pdbUtils";

interface PdbUploadProps {
  file: File | null;
  chains: PdbChainInfo[];
  onLoad: (file: File, text: string) => void;
  onClear: () => void;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-white/40";

export default function PdbUpload({
  file,
  chains,
  onLoad,
  onClear,
}: PdbUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(selected: File | undefined) {
    if (!selected) return;

    setReading(true);
    setError("");

    try {
      const text = await selected.text();
      const problem = validatePdbFile(selected, text);

      if (problem) {
        setError(problem);
        return;
      }

      // Keep our own in-memory copy. The browser's handle on the picked
      // file stops working once the input is reset, and fails outright if
      // the file changes on disk after it was chosen.
      onLoad(pdbToFile(text, selected.name), text);
    } catch {
      setError("Could not read this file.");
    } finally {
      setReading(false);

      // Lets the same file be chosen again after removing it.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files[0]);
  }

  function handleClear() {
    setError("");
    onClear();
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        id="pdb-file"
        type="file"
        accept=".pdb"
        className="sr-only"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      {file ? (
        <section className="rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {file.name}
              </div>

              <div className="mt-1 font-mono text-[10px] text-white/30">
                {formatBytes(file.size)}
              </div>
            </div>

            <div className="flex shrink-0 gap-1.5">
              <label
                htmlFor="pdb-file"
                className={`cursor-pointer rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/5 hover:text-white has-[:focus-visible]:ring-2 ${focusRing}`}
              >
                Replace
              </label>

              <button
                type="button"
                onClick={handleClear}
                className={`rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/5 hover:text-red-300 ${focusRing}`}
              >
                Remove
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="mb-2 text-xs text-white/45">
              {chains.length === 1
                ? "1 chain"
                : `${chains.length} chains`}
            </div>

            <ul className="flex flex-wrap gap-2">
              {chains.map((chain) => (
                <li
                  key={chain.id}
                  className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5"
                >
                  <span className="font-mono text-sm font-semibold">
                    {chain.id}
                  </span>

                  <span className="font-mono text-[10px] text-white/35">
                    {chain.residues} aa
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs leading-5 text-white/35">
              Open the DSSP analysis tab to find helices,
              sheets and solvent accessibility for any
              chain.
            </p>
          </div>
        </section>
      ) : (
        <label
          htmlFor="pdb-file"
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={[
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition has-[:focus-visible]:ring-2",
            dragOver
              ? "border-cyan-400/60 bg-cyan-400/[0.06]"
              : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]",
          ].join(" ")}
        >
          <div className="text-sm font-medium">
            {reading ? "Reading file…" : "Drop a .pdb file here"}
          </div>

          <div className="mt-1.5 text-xs text-white/40">
            or click to browse
          </div>

          <div className="mt-5 text-[11px] text-white/25">
            Up to {formatBytes(MAX_PDB_BYTES)}
          </div>
        </label>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-xs leading-5 text-red-300"
        >
          {error}
        </div>
      )}
    </div>
  );
}
