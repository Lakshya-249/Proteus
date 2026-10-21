export interface PdbSearchResult {
  pdbId: string;
  title?: string;
  method?: string;
  /** Best resolution in angstroms, when the method has one (not NMR). */
  resolution?: number;
}

interface EntrySummary {
  rcsb_id: string;
  struct?: { title?: string };
  rcsb_entry_info?: {
    experimental_method?: string;
    resolution_combined?: number[] | null;
  };
}

/* Adds title / method / resolution so results are recognisable, not bare IDs. */
async function fetchSummaries(ids: string[]): Promise<Map<string, EntrySummary>> {
  const query = `
    query($ids: [String!]!) {
      entries(entry_ids: $ids) {
        rcsb_id
        struct { title }
        rcsb_entry_info { experimental_method resolution_combined }
      }
    }`;
  const response = await fetch("https://data.rcsb.org/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { ids } }),
  });
  if (!response.ok) throw new Error("summary request failed");
  const body = (await response.json()) as { data?: { entries?: (EntrySummary | null)[] } };
  return new Map(
    (body.data?.entries ?? [])
      .filter((entry): entry is EntrySummary => Boolean(entry))
      .map((entry) => [entry.rcsb_id, entry]),
  );
}

interface RcsbSearchResponse {
  result_set?: {
    identifier: string;
  }[];
}

export async function searchPdb(
  query: string,
): Promise<PdbSearchResult[]> {
  const response = await fetch(
    "https://search.rcsb.org/rcsbsearch/v2/query",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          type: "terminal",
          service: "full_text",
          parameters: {
            value: query,
          },
        },
        return_type: "entry",
        request_options: {
          paginate: {
            start: 0,
            rows: 8,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error("PDB search failed");
  }

  const data: RcsbSearchResponse = await response.json();

  const ids = (data.result_set ?? []).map((result) => result.identifier);

  let summaries = new Map<string, EntrySummary>();
  try {
    summaries = await fetchSummaries(ids);
  } catch {
    // Details are a nicety; fall back to bare IDs.
  }

  return ids.map((pdbId) => {
    const entry = summaries.get(pdbId);
    return {
      pdbId,
      title: entry?.struct?.title,
      method: entry?.rcsb_entry_info?.experimental_method,
      resolution: entry?.rcsb_entry_info?.resolution_combined?.[0],
    };
  });
}
