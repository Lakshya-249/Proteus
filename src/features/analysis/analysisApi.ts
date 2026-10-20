import type { AnalysisResult } from "./useProteinAnalysis";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

/**
 * Runs DSSP on a user-supplied .pdb file for one chain.
 * Works for both uploaded files and generated structures.
 */
export async function runDsspOnFile(
  file: File,
  chainId: string,
): Promise<AnalysisResult> {
  const body = new FormData();
  body.append("file", file, file.name);
  body.append("chain_id", chainId);

  // No Content-Type header: the browser adds the multipart boundary.
  const response = await fetch(`${API_BASE_URL}/analysis/dssp/file`, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as AnalysisResult;

  if (!data.residues?.length) {
    throw new Error(`DSSP returned no residues for chain ${chainId}.`);
  }

  return data;
}

async function readError(response: Response): Promise<string> {
  const fallback = `DSSP failed (${response.status}).`;

  try {
    const data = await response.json();

    if (typeof data.detail === "string") return data.detail;

    // FastAPI validation errors arrive as a list.
    if (Array.isArray(data.detail) && data.detail[0]?.msg) {
      return data.detail[0].msg;
    }
  } catch {
    // Not JSON: keep the fallback.
  }

  return fallback;
}
