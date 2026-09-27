export interface ProteinMetadata {
  id: string;
  title: string;
  method: string;
  molecularWeight?: number;
  chains: ProteinChain[];
}

export interface ProteinChain {
  id: string;
  name: string;
  organism?: string;
  length?: number;
  sequence?: string;
  polymerType?: string;   // ← added, e.g. "Protein" | "DNA" | "RNA"
}

interface RcsbGraphQLResponse {
  data?: {
    entry?: {
      rcsb_id?: string;

      struct?: {
        title?: string;
      };

      rcsb_entry_info?: {
        structure_determination_methodology?: string;
        molecular_weight?: number;
      };

      polymer_entities?: {
        rcsb_id?: string;

        entity_poly?: {
          type?: string;
          pdbx_seq_one_letter_code_can?: string;
          rcsb_sample_sequence_length?: number;
        };

        rcsb_polymer_entity_container_identifiers?: {
          auth_asym_ids?: string[];
        };

        rcsb_entity_source_organism?: {
          ncbi_scientific_name?: string;
        }[];
      }[];
    };
  };

  errors?: {
    message: string;
  }[];
}

export async function getProteinMetadata(
  pdbId: string,
): Promise<ProteinMetadata> {
  const id = pdbId.toUpperCase();

  const query = `
    query ProteinEntry($entryId: String!) {
      entry(entry_id: $entryId) {
        rcsb_id

        struct {
          title
        }

        rcsb_entry_info {
          structure_determination_methodology
          molecular_weight
        }

        polymer_entities {
          rcsb_id

          entity_poly {
            type
            pdbx_seq_one_letter_code_can
            rcsb_sample_sequence_length
          }

          rcsb_polymer_entity_container_identifiers {
            auth_asym_ids
          }

          rcsb_entity_source_organism {
            ncbi_scientific_name
          }
        }
      }
    }
  `;

  const response = await fetch(
    "https://data.rcsb.org/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          entryId: id,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error("RCSB GraphQL request failed");
  }

  const result: RcsbGraphQLResponse =
    await response.json();

  if (result.errors?.length) {
    throw new Error(result.errors[0].message);
  }

  const entry = result.data?.entry;

  if (!entry) {
    throw new Error(`Protein ${id} not found`);
  }

  const chains: ProteinChain[] =
    entry.polymer_entities?.flatMap((entity) => {
      const chainIds =
        entity
          .rcsb_polymer_entity_container_identifiers
          ?.auth_asym_ids ?? [];

      return chainIds.map((chainId) => ({
        id: chainId,
        name: entity.rcsb_id ?? chainId,
        organism:
          entity.rcsb_entity_source_organism?.[0]
            ?.ncbi_scientific_name,
        length:
          entity.entity_poly
            ?.rcsb_sample_sequence_length,
        sequence:
          entity.entity_poly
            ?.pdbx_seq_one_letter_code_can,
        polymerType: entity.entity_poly?.type,
      }));
    }) ?? [];

  return {
    id,
    title: entry.struct?.title ?? "Unknown protein",

    method:
      entry.rcsb_entry_info
        ?.structure_determination_methodology ??
      "Unknown",

    molecularWeight:
      entry.rcsb_entry_info?.molecular_weight,

    chains,
  };
}
