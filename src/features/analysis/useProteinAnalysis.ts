import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "../../lib/http";

export interface DSSPResidue {
  resi: number;
  /** PDB insertion code, if any. */
  icode?: string;
  resn: string;
  secondary_structure: string;
  /** Absolute accessible surface area, in square angstroms. */
  accessibility: number;
  /** Accessibility relative to the residue's maximum, 0-100. Null for unknown residues. */
  rel_accessibility?: number | null;
  /** Backbone dihedrals in degrees; null where undefined (chain termini). */
  phi?: number | null;
  psi?: number | null;
}

export interface AnalysisResult {
  method: string;
  /** Set by the PDB-ID endpoint. */
  pdb_id?: string;
  /** Set by the file-upload endpoint. */
  filename?: string;
  chain_id: string;
  residues: DSSPResidue[];
}

interface UseProteinAnalysisReturn {
  runAnalysis: (pdbId: string, chainId: string) => Promise<void>;
  result: AnalysisResult | null;
  loading: boolean;
  error: string;
}

export function useProteinAnalysis(): UseProteinAnalysisReturn {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request when the component unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const runAnalysis = useCallback(async (pdbId: string, chainId: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await postJson<AnalysisResult>(
        "/analysis/dssp",
        { pdb_id: pdbId, chain_id: chainId },
        { signal: controller.signal, fallbackError: "Unable to run DSSP analysis." },
      );
      setResult(data);
    } catch (err) {
      if (controller.signal.aborted) return; // superseded or unmounted
      console.error("DSSP analysis failed:", err);
      setError(err instanceof Error ? err.message : "Unable to run DSSP analysis.");
    } finally {
      if (controllerRef.current === controller) setLoading(false);
    }
  }, []);

  return { runAnalysis, result, loading, error };
}
