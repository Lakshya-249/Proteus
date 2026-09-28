import { useState } from "react";

export interface DSSPResidue {
  resi: number;
  resn: string;
  secondary_structure: string;
  accessibility: number;
}

export interface AnalysisResult {
  method: string;
  pdb_id: string;
  chain_id: string;
  residues: DSSPResidue[];
}

interface UseProteinAnalysisReturn {
  runAnalysis: (
    pdbId: string,
    chainId: string,
  ) => Promise<void>;
  result: AnalysisResult | null;
  loading: boolean;
  error: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:8000/api"

export function useProteinAnalysis(): UseProteinAnalysisReturn {
  const [result, setResult] =
    useState<AnalysisResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runAnalysis(
    pdbId: string,
    chainId: string,
  ) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/analysis/dssp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pdb_id: pdbId,
            chain_id: chainId,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body || `Analysis failed (${response.status})`,
        );
      }

      const data: AnalysisResult =
        await response.json();

      setResult(data);
    } catch (error) {
      console.error(
        "DSSP analysis failed:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to run DSSP analysis.",
      );
    } finally {
      setLoading(false);
    }
  }

  return {
    runAnalysis,
    result,
    loading,
    error,
  };
}
