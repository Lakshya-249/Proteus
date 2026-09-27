const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:8000/api";

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
