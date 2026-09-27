const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

interface GeneratePDBResponse {
  pdb: string;
}

export async function generatePDB(
  sequence: string,
  structure: string,
): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/design/structure`,
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
    let message = "Failed to generate structure.";

    try {
      const data = await response.json();

      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Keep default error message.
    }

    throw new Error(message);
  }

  const data =
    (await response.json()) as GeneratePDBResponse;

  if (!data.pdb) {
    throw new Error(
      "API returned an empty PDB structure.",
    );
  }

  return data.pdb;
}
