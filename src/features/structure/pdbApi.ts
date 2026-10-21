import { API_BASE_URL } from "../../config";
import { postJson } from "../../lib/http";

export async function generatePDB(
  sequence: string,
  structure: string,
): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/structure/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sequence,
        structure,
      }),
    },
  );

  if (!response.ok) {
    let message =
      "Failed to generate structure.";

    try {
      const data = await response.json();

      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Ignore malformed error responses.
    }

    throw new Error(message);
  }

  const data = await response.json();

  if (!data.pdb) {
    throw new Error(
      "API returned an empty PDB.",
    );
  }

  return data.pdb;
}


export interface ComplexChain {
  id: string;
  sequence: string;
  structure: string;
}


export async function generateComplexPDB(
  chains: ComplexChain[],
): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/structure/generate-complex`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chains,
      }),
    },
  );

  if (!response.ok) {
    let message =
      "Failed to generate protein complex.";

    try {
      const data = await response.json();

      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Ignore malformed error responses.
    }

    throw new Error(message);
  }

  const data = await response.json();

  if (!data.pdb) {
    throw new Error(
      "API returned an empty PDB.",
    );
  }

  return data.pdb;
}


export interface GeneratedStructure {
  pdb: string;
  /** Non-fatal issues, e.g. steric clashes in the idealised backbone. */
  warnings: string[];
}

export async function generateComplexStructure(
  chains: ComplexChain[],
): Promise<GeneratedStructure> {
  const data = await postJson<{ pdb?: string; warnings?: string[] }>(
    "/structure/generate-complex",
    { chains },
    { fallbackError: "Failed to generate protein complex." },
  );
  if (!data.pdb) throw new Error("API returned an empty PDB.");
  return { pdb: data.pdb, warnings: data.warnings ?? [] };
}

/** Real fold prediction (ESMFold). B-factor column holds pLDDT confidence. */
export async function predictStructure(sequence: string): Promise<string> {
  const data = await postJson<{ pdb?: string }>(
    "/structure/predict",
    { sequence },
    { fallbackError: "Structure prediction failed." },
  );
  if (!data.pdb) throw new Error("Prediction service returned no structure.");
  return data.pdb;
}
