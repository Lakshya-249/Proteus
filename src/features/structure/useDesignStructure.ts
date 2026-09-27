import { useState } from "react";

interface DesignResult {
  sequence: string;
  structure: string;
  pdb: string;
}

export function useDesignStructure() {
  const [result, setResult] =
    useState<DesignResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function generateStructure(
    sequence: string,
    structure: string,
  ) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/design/structure",
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ?? "Structure generation failed.",
        );
      }

      setResult(data);

      return data;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Structure generation failed.";

      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setResult(null);
    setError(null);
  }

  return {
    generateStructure,
    result,
    loading,
    error,
    clear,
  };
}
