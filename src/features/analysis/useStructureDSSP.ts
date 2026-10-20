import { useMemo, useRef, useState } from "react";
import { runDsspOnFile } from "./analysisApi";
import type { AnalysisResult } from "./useProteinAnalysis";

/**
 * DSSP for a structure that exists as a file (uploaded or generated).
 * Results are kept per chain so several chains can be analysed and coloured
 * in the 3D viewer at once.
 */
export function useStructureDSSP() {
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Lets reset() and newer runs discard responses from older runs.
  const runId = useRef(0);

  const list = useMemo(() => Object.values(results), [results]);

  async function run(file: File, chains: string[]) {
    const id = ++runId.current;

    setLoading(true);
    setError("");

    const failures: string[] = [];

    for (const chain of chains) {
      try {
        const result = await runDsspOnFile(file, chain);
        if (runId.current !== id) return;

        setResults((current) => ({ ...current, [chain]: result }));
      } catch (err) {
        if (runId.current !== id) return;

        const message =
          err instanceof Error ? err.message : "Unable to run DSSP.";

        failures.push(
          chains.length > 1 ? `Chain ${chain}: ${message}` : message,
        );
      }
    }

    setError(failures.join("\n"));
    setLoading(false);
  }

  function reset() {
    runId.current++;
    setResults({});
    setError("");
    setLoading(false);
  }

  return { results, list, loading, error, run, reset };
}
