export interface PdbSearchResult {
  pdbId: string;
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

  return (data.result_set ?? []).map((result) => ({
    pdbId: result.identifier,
  }));
}
