export const MAX_PDB_BYTES = 25 * 1024 * 1024;

export interface PdbChainInfo {
  id: string;
  residues: number;
}

/**
 * Lists the protein chains in a PDB file along with their residue counts.
 * Only ATOM records of the first model are considered, which matches what
 * DSSP analyses.
 */
export function parsePdbChains(text: string): PdbChainInfo[] {
  const chains = new Map<string, Set<string>>();

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("ENDMDL")) break;
    if (!line.startsWith("ATOM")) continue;

    const chainId = line.charAt(21).trim();
    if (!chainId) continue;

    // Residue number + insertion code uniquely identifies a residue.
    const residueKey = line.slice(22, 27);

    if (!chains.has(chainId)) chains.set(chainId, new Set());
    chains.get(chainId)!.add(residueKey);
  }

  return [...chains.entries()]
    .map(([id, residues]) => ({ id, residues: residues.size }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Returns an error message, or null when the file looks like a usable PDB. */
export function validatePdbFile(file: File, text: string): string | null {
  if (!file.name.toLowerCase().endsWith(".pdb")) {
    return "Please choose a .pdb file.";
  }

  if (file.size === 0 || !text.trim()) {
    return "This file is empty.";
  }

  if (file.size > MAX_PDB_BYTES) {
    return `This file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_PDB_BYTES)}.`;
  }

  if (parsePdbChains(text).length === 0) {
    return "No protein chains found. The file needs ATOM records with a chain ID.";
  }

  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pdbToFile(pdb: string, name = "designed.pdb"): File {
  return new File([pdb], name, { type: "chemical/x-pdb" });
}

export function downloadTextFile(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "chemical/x-pdb" }),
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
