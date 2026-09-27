export interface FunctionalSite {
  label: string;
  chain: string;
  residues: number[];
  description: string;
  chemicalRole: string;
  druggabilityScore?: number;
}

export interface MutationVariant {
  mutation: string;
  resi: number;
  impact: string;
  chain: string;              // ← added
  clinicalSignificance: string;
  predictedDdg?: number;
  phenotype?:
    | "neutral"
    | "destabilizing"
    | "pathogenic_loss_of_function"
    | "hyperactive";
}

export interface DomainRegion {
  name: string;
  start: number;
  end: number;
  function: string;
  type: "catalytic" | "binding" | "structural";
  chain: string;              // ← added
}

export interface DetailedAIInsights {
  summary: string;
  domains: DomainRegion[];
  functionalSites: FunctionalSite[];
  pathologyVariants: MutationVariant[];
}

interface AIInsightsRequest {
  pdbId: string;
  chainId?: string;
  sequence?: string;
}

/*
 * Expects a backend endpoint that proxies to an LLM.
 *
 * Request:
 *   POST /api/ai/insights
 *   { pdbId, chainId, sequence }
 *
 * Response — field names matter, they map 1:1 onto
 * AIInsightsPage's local types:
 *   {
 *     summary: string,
 *     domains: [
 *       { name, start, end, function, type: "catalytic" | "binding" | "structural" }
 *     ],
 *     functionalSites: [
 *       { label, chain, residues: number[], description, chemicalRole, druggabilityScore? }
 *     ],
 *     pathologyVariants: [
 *       { mutation, resi, impact, clinicalSignificance, predictedDdg?, phenotype? }
 *     ]
 *   }
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:8000";

export async function getAIInsights(
  request: AIInsightsRequest,
): Promise<DetailedAIInsights> {
  const response = await fetch(`${API_BASE_URL}/api/ai/insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(
      "Failed to generate AI insights.",
    );
  }

  return response.json();
}
