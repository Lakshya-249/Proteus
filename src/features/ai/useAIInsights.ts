import { useCallback, useState } from "react";

import {
  getAIInsights,
  type DetailedAIInsights,
} from "./aiInsights";

export function useAIInsights() {
  const [result, setResult] =
    useState<DetailedAIInsights | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const runInsights = useCallback(
    async (
      pdbId: string,
      chainId?: string,
      sequence?: string,
    ) => {
      setLoading(true);
      setError("");

      try {
        const data = await getAIInsights({
          pdbId,
          chainId,
          sequence,
        });

        setResult(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate insights.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    result,
    loading,
    error,
    runInsights,
  };
}
