import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import $3Dmol, { GLViewer } from "3dmol";

import type { AnalysisResult } from "../analysis/useProteinAnalysis";

type Representation = "cartoon" | "surface" | "stick";

export interface ResidueInfo {
  resi: number;
  resn: string;
}

export interface HighlightSelection {
  chain: string;
  residues: number[];
  color: string;
}

interface ProteinViewerProps {
  /*
   * Existing proteins can still be loaded using
   * their RCSB PDB ID.
   */
  pdbId?: string;

  /*
   * Generated structures can be passed directly
   * as PDB text.
   */
  pdbData?: string;

  /*
   * Legacy single-residue highlight (white sphere).
   * Still used by the sequence-click flow on the
   * main protein page.
   */
  selectedResidue?: {
    chain: string;
    residue: number;
  } | null;

  /*
   * Multi-residue colored highlight, used by the
   * AI Insights page to spotlight a functional site,
   * mutation, or domain range.
   */
  highlightSelection?: HighlightSelection | null;

  /*
   * When provided, overrides the viewer's own internal
   * chain filter — lets a parent page drive which chain
   * is shown (e.g. a "Subunit" filter of its own).
   */
  forcedChain?: string;

  onResidueMap?: (
    map: Record<string, ResidueInfo[]>,
  ) => void;

  dsspResult?: AnalysisResult | null;
}

function ProteinViewer({
  pdbId,
  pdbData,
  selectedResidue,
  highlightSelection,
  forcedChain,
  onResidueMap,
  dsspResult,
}: ProteinViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef(null);
  const modelLoaded = useRef(false);

  const [representation, setRepresentation] =
    useState<Representation>("cartoon");

  const [chains, setChains] = useState<string[]>([]);
  const [selectedChain, setSelectedChain] =
    useState("all");

  /*
   * forcedChain, when provided, always wins over the
   * viewer's own internal chain selection.
   */
  const effectiveChain =
    forcedChain ?? selectedChain;

  /*
   * Load the PDB structure.
   *
   * There are now two possible sources:
   *
   * 1. pdbData
   *    Generated locally/by the backend.
   *
   * 2. pdbId
   *    Existing RCSB structure.
   */
  useEffect(() => {
    if (!viewerRef.current) return;

    modelLoaded.current = false;

    const viewer = $3Dmol.createViewer(
      viewerRef.current,
      {
        backgroundColor: "#05070a",
      },
    );

    viewerInstance.current = viewer;

    const loadStructure = async () => {
      try {
        let pdbText: string;

        /*
         * Generated structure.
         *
         * This takes priority over pdbId.
         */
        if (pdbData) {
          pdbText = pdbData;
        } else if (pdbId) {
          /*
           * Existing RCSB behavior.
           */
          const pdbUrl =
            `https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`;

          const response = await fetch(pdbUrl);

          if (!response.ok) {
            throw new Error(
              `Failed to load PDB: ${pdbId}`,
            );
          }

          pdbText = await response.text();
        } else {
          throw new Error(
            "No PDB ID or PDB data provided.",
          );
        }

        viewer.addModel(pdbText, "pdb");

        const model = viewer.getModel();
        const atoms = model.selectedAtoms({});

        const residueMap: Record<
          string,
          ResidueInfo[]
        > = {};

        for (const atom of atoms) {
          if (
            !atom.chain ||
            atom.resi == null
          ) {
            continue;
          }

          if (!residueMap[atom.chain]) {
            residueMap[atom.chain] = [];
          }

          const chainResidues =
            residueMap[atom.chain];

          const exists = chainResidues.some(
            (residue) =>
              residue.resi === atom.resi,
          );

          if (!exists) {
            chainResidues.push({
              resi: atom.resi,
              resn: atom.resn as string,
            });
          }
        }

        onResidueMap?.(residueMap);

        setChains(
          Object.keys(residueMap).sort(),
        );

        /*
         * A newly loaded structure should always
         * start on all chains, unless a parent is
         * already forcing one.
         */
        setSelectedChain("all");

        modelLoaded.current = true;

        applyRepresentation(
          viewer,
          "cartoon",
          forcedChain ?? "all",
        );

        viewer.zoomTo();
        viewer.render();
      } catch (error) {
        console.error(
          "Failed to load protein:",
          error,
        );
      }
    };

    loadStructure();

    const handleResize = () => {
      viewer.resize();
    };

    window.addEventListener(
      "resize",
      handleResize,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize,
      );

      modelLoaded.current = false;

      viewer.clear();
      viewerInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdbId, pdbData, onResidueMap]);

  /*
   * Re-render whenever:
   *
   * - representation changes
   * - chain changes (internal or forced)
   * - DSSP finishes
   * - residue selection changes
   * - highlight selection changes
   */
  useEffect(() => {
    if (
      !viewerInstance.current ||
      !modelLoaded.current
    ) {
      return;
    }

    const viewer = viewerInstance.current as GLViewer;

    viewer.setStyle({}, {});
    viewer.removeAllSurfaces();

    applyRepresentation(
      viewer,
      representation,
      effectiveChain,
    );

    /*
     * DSSP colors are applied AFTER the base
     * representation so they override the
     * cartoon colors.
     */
    applyDSSPStyles(
      viewer,
      dsspResult,
      effectiveChain,
    );

    /*
     * highlightSelection takes priority; falls back
     * to the legacy single-residue selection.
     */
    if (highlightSelection) {
      applyHighlightSelection(
        viewer,
        highlightSelection,
      );
    } else if (selectedResidue) {
      applySelectedResidue(
        viewer,
        selectedResidue,
      );
    }

    viewer.render();
  }, [
    dsspResult,
    representation,
    effectiveChain,
    selectedResidue,
    highlightSelection,
  ]);

  function changeRepresentation(
    next: Representation,
  ) {
    if (
      !viewerInstance.current ||
      !modelLoaded.current
    ) {
      return;
    }

    const viewer = viewerInstance.current as GLViewer;

    try {
      viewer.setStyle({}, {});
      viewer.removeAllSurfaces();

      applyRepresentation(
        viewer,
        next,
        effectiveChain,
      );

      applyDSSPStyles(
        viewer,
        dsspResult,
        effectiveChain,
      );

      if (highlightSelection) {
        applyHighlightSelection(
          viewer,
          highlightSelection,
        );
      } else if (selectedResidue) {
        applySelectedResidue(
          viewer,
          selectedResidue,
        );
      } else {
        viewer.zoomTo();
      }

      viewer.render();

      setRepresentation(next);
    } catch (error) {
      console.error(
        `Failed to switch to ${next}:`,
        error,
      );

      viewer.setStyle({}, {});
      viewer.removeAllSurfaces();

      applyRepresentation(
        viewer,
        "cartoon",
        effectiveChain,
      );

      applyDSSPStyles(
        viewer,
        dsspResult,
        effectiveChain,
      );

      viewer.zoomTo();
      viewer.render();

      setRepresentation("cartoon");
    }
  }

  function changeChain(chain: string) {
    if (
      !viewerInstance.current ||
      !modelLoaded.current
    ) {
      return;
    }

    const viewer = viewerInstance.current as GLViewer;

    viewer.setStyle({}, {});
    viewer.removeAllSurfaces();

    applyRepresentation(
      viewer,
      representation,
      chain,
    );

    applyDSSPStyles(
      viewer,
      dsspResult,
      chain,
    );

    if (highlightSelection) {
      applyHighlightSelection(
        viewer,
        highlightSelection,
      );
    } else if (selectedResidue) {
      applySelectedResidue(
        viewer,
        selectedResidue,
      );
    } else {
      viewer.zoomTo();
    }

    viewer.render();

    setSelectedChain(chain);
  }

  function resetView() {
    if (!viewerInstance.current) return;

    const viewer = viewerInstance.current as GLViewer;

    viewer?.zoomTo();
    viewer?.render();
  }

  return (
    <div
      ref={viewerRef}
      className="relative h-full min-h-[70vh] w-full"
    >
      {/* DSSP legend */}
      {dsspResult && (
        <div className="absolute right-4 top-4 z-20 border border-white/10 bg-black/60 p-2.5 backdrop-blur sm:right-6 sm:top-6 sm:p-3">
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">
            DSSP
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:gap-x-4">
            <LegendItem
              color="#22d3ee"
              label="Helix"
            />

            <LegendItem
              color="#a78bfa"
              label="Sheet"
            />

            <LegendItem
              color="#fbbf24"
              label="Turn / Bend"
            />

            <LegendItem
              color="#94a3b8"
              label="Coil"
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute inset-x-4 bottom-4 z-20 flex flex-wrap items-center gap-2 sm:inset-x-6 sm:bottom-6">
        <ControlGroup label="VIEW">
          {(
            [
              "cartoon",
              "surface",
              "stick",
            ] as Representation[]
          ).map((type) => (
            <button
              key={type}
              onClick={() =>
                changeRepresentation(type)
              }
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider outline-none transition focus-visible:ring-2 focus-visible:ring-white/40 ${
                representation === type
                  ? "bg-white text-black"
                  : "bg-black/60 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </ControlGroup>

        {/*
         * Hide the internal chain filter when a parent
         * page is already driving the chain via
         * forcedChain (e.g. AI Insights' own Subunit
         * filter) — avoids two redundant controls.
         */}
        {chains.length > 0 && !forcedChain && (
          <ControlGroup label="CHAIN">
            <button
              onClick={() =>
                changeChain("all")
              }
              className={`px-3 py-1.5 font-mono text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                selectedChain === "all"
                  ? "bg-white text-black"
                  : "bg-black/60 text-white/50 hover:bg-white/10"
              }`}
            >
              ALL
            </button>

            {chains.map((chain) => (
              <button
                key={chain}
                onClick={() =>
                  changeChain(chain)
                }
                className={`px-3 py-1.5 font-mono text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  selectedChain === chain
                    ? "bg-white text-black"
                    : "bg-black/60 text-white/50 hover:bg-white/10"
                }`}
              >
                {chain}
              </button>
            ))}
          </ControlGroup>
        )}

        <button
          onClick={resetView}
          className="bg-black/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/50 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Reset
        </button>
      </div>

      <div className="absolute bottom-6 right-6 z-20 hidden font-mono text-[10px] text-white/30 sm:block">
        DRAG TO ROTATE · SCROLL TO ZOOM
      </div>
    </div>
  );
}

/*
 * Apply DSSP secondary-structure information
 * directly onto the 3D protein.
 */
function applyDSSPStyles(
  viewer: GLViewer,
  dsspResult: AnalysisResult | null | undefined,
  selectedChain: string,
) {
  if (
    !dsspResult ||
    dsspResult.residues.length === 0
  ) {
    return;
  }

  const dsspChain =
    dsspResult.chain_id;

  /*
   * DSSP was calculated for one chain.
   * Don't paint another chain with those residues.
   */
  if (
    selectedChain !== "all" &&
    selectedChain !== dsspChain
  ) {
    return;
  }

  const helix: number[] = [];
  const sheet: number[] = [];
  const turn: number[] = [];
  const coil: number[] = [];

  for (const residue of dsspResult.residues) {
    const structure =
      residue.secondary_structure;

    switch (structure) {
      /*
       * H = alpha helix
       * G = 3_10 helix
       * I = pi helix
       * P = poly-proline II helix
       */
      case "H":
      case "G":
      case "I":
      case "P":
        helix.push(residue.resi);
        break;

      /*
       * E = extended strand
       * B = beta bridge
       */
      case "E":
      case "B":
        sheet.push(residue.resi);
        break;

      /*
       * T = turn
       * S = bend
       */
      case "T":
      case "S":
        turn.push(residue.resi);
        break;

      /*
       * Blank / C / unknown = coil
       */
      default:
        coil.push(residue.resi);
        break;
    }
  }

  const baseSelection = {
    chain: dsspChain,
  };

  if (helix.length > 0) {
    viewer.addStyle(
      {
        ...baseSelection,
        resi: helix,
      },
      {
        cartoon: {
          color: "#22d3ee",
        },
      },
    );
  }

  if (sheet.length > 0) {
    viewer.addStyle(
      {
        ...baseSelection,
        resi: sheet,
      },
      {
        cartoon: {
          color: "#a78bfa",
        },
      },
    );
  }

  if (turn.length > 0) {
    viewer.addStyle(
      {
        ...baseSelection,
        resi: turn,
      },
      {
        cartoon: {
          color: "#fbbf24",
        },
      },
    );
  }

  if (coil.length > 0) {
    viewer.addStyle(
      {
        ...baseSelection,
        resi: coil,
      },
      {
        cartoon: {
          color: "#94a3b8",
        },
      },
    );
  }
}

/*
 * Existing residue-selection behavior.
 * DO NOT change resi -> lresi.
 */
function applySelectedResidue(
  viewer: GLViewer,
  selectedResidue: {
    chain: string;
    residue: number;
  },
) {
  const selection = {
    chain: selectedResidue.chain,
    resi: selectedResidue.residue,
  };

  const selectedAtoms =
    viewer.selectedAtoms(selection);

  console.log(
    "3D SELECTION:",
    selection,
    "ATOMS:",
    selectedAtoms.length,
  );

  viewer.addStyle(selection, {
    sphere: {
      radius: 0.45,
      color: "#ffffff",
      opacity: 0.9,
    },
  });

  viewer.zoomTo(selection);
  viewer.render();
}

/*
 * Multi-residue colored highlight for the AI Insights
 * page: colors the cartoon + sticks for the whole
 * selection and zooms to it, so clicking a functional
 * site / mutation / domain visibly focuses the camera.
 */
function applyHighlightSelection(
  viewer: GLViewer,
  highlight: HighlightSelection,
) {
  if (!highlight.residues.length) return;

  const selection = {
    chain: highlight.chain,
    resi: highlight.residues,
  };

  viewer.addStyle(selection, {
    cartoon: {
      color: highlight.color,
    },
    stick: {
      radius: 0.22,
      color: highlight.color,
    },
    sphere: {
      radius: 0.35,
      color: highlight.color,
      opacity: 0.75,
    },
  });

  viewer.zoomTo(selection);
  viewer.render();
}

function applyRepresentation(
  viewer: GLViewer,
  representation: Representation,
  chain: string,
) {
  const selection =
    chain === "all"
      ? {}
      : {
          chain,
        };

  switch (representation) {
    case "cartoon":
      viewer.setStyle(selection, {
        cartoon: {
          color: "spectrum",
        },
      });
      break;

    case "stick":
      viewer.setStyle(selection, {
        stick: {
          radius: 0.15,
          colorscheme: "Jmol",
        },
      });
      break;

    case "surface":
      viewer.addSurface(
        $3Dmol.SurfaceType.VDW,
        {
          opacity: 0.85,
          color: "white",
        },
        selection,
      );
      break;
  }
}

interface ControlGroupProps {
  label: string;
  children: ReactNode;
}

function ControlGroup({
  label,
  children,
}: ControlGroupProps) {
  return (
    <div className="flex overflow-hidden border border-white/10 bg-black/50 backdrop-blur">
      <div className="border-r border-white/10 px-2 py-1.5 font-mono text-[9px] text-white/30">
        {label}
      </div>

      {children}
    </div>
  );
}

function LegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor: color,
        }}
      />

      <span className="font-mono text-[9px] text-white/40">
        {label}
      </span>
    </div>
  );
}

export default ProteinViewer;
