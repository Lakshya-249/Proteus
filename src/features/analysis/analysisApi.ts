import type { AnalysisResult } from "./useProteinAnalysis";

import { API_BASE_URL } from "../../config";
import { readError } from "../../lib/http";

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
    throw new Error(await readError(response, `DSSP failed (${response.status}).`));
  }

  const data = (await response.json()) as AnalysisResult;

  if (!data.residues?.length) {
    throw new Error(`DSSP returned no residues for chain ${chainId}.`);
  }

  return data;
}
