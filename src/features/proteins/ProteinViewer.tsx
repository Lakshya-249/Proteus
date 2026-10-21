import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import $3Dmol, { GLViewer } from "3dmol";
import type { AnalysisResult } from "../analysis/useProteinAnalysis";

type Representation = "cartoon" | "surface" | "stick";
type ColorMode = "default" | "chain" | "hydrophobicity" | "bfactor";
type LoadStatus = "loading" | "ready" | "error";

export interface ResidueInfo {
  resi: number;
  resn: string;
}

export interface HighlightSelection {
  chain: string;
  residues: number[];
  color: string;
}

export interface PickedResidue {
  chain: string;
  residue: number;
  resn: string;
}

interface ProteinViewerProps {
  /* Existing proteins are loaded by RCSB PDB ID. */
  pdbId?: string;
  /* Generated / predicted structures can be passed directly as PDB text. */
  pdbData?: string;
  /* Single-residue highlight driven by the parent (sequence click flow). */
  selectedResidue?: {
    chain: string;
    residue: number;
  } | null;
  /* Multi-residue colored highlight (AI Insights page). */
  highlightSelection?: HighlightSelection | null;
  /* When provided, overrides the viewer's own chain filter. */
  forcedChain?: string;
  onResidueMap?: (map: Record<string, ResidueInfo[]>) => void;
  /* Fired when the user clicks an atom in the 3D view. */
  onResidueClick?: (picked: PickedResidue) => void;
  dsspResult?: AnalysisResult | null;
  /* DSSP results for several chains at once; used instead of dsspResult. */
  dsspResults?: AnalysisResult[];
}

interface HoverInfo {
  text: string;
  x: number;
  y: number;
}

interface AtomLike {
  chain?: string;
  resi?: number;
  resn?: string;
  atom?: string;
  b?: number;
}

const COLOR_MODES: { value: ColorMode; label: string; hint: string }[] = [
  { value: "default", label: "Rainbow / DSSP", hint: "Rainbow N→C, or DSSP colors once analysis has run" },
  { value: "chain", label: "Chain", hint: "One color per chain" },
  { value: "hydrophobicity", label: "Hydrophobicity", hint: "Kyte-Doolittle: orange = hydrophobic, blue = polar" },
  { value: "bfactor", label: "B-factor / pLDDT", hint: "Red = low. For predicted structures this is confidence (pLDDT)" },
];

/* Kyte-Doolittle hydropathy, mapped to a blue (polar) -> orange (hydrophobic) ramp. */
const KYTE_DOOLITTLE: Record<string, number> = {
  ILE: 4.5, VAL: 4.2, LEU: 3.8, PHE: 2.8, CYS: 2.5, MET: 1.9, ALA: 1.8,
  GLY: -0.4, THR: -0.7, SER: -0.8, TRP: -0.9, TYR: -1.3, PRO: -1.6,
  HIS: -3.2, GLU: -3.5, GLN: -3.5, ASP: -3.5, ASN: -3.5, LYS: -3.9, ARG: -4.5,
};

function hydrophobicityColor(atom: AtomLike): number {
  const score = KYTE_DOOLITTLE[atom.resn ?? ""] ?? 0;
  const t = (score + 4.5) / 9; // 0 polar .. 1 hydrophobic
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return (lerp(0x3b, 0xf9) << 16) | (lerp(0x82, 0x73) << 8) | lerp(0xf6, 0x16);
}

function colorOption(mode: ColorMode): Record<string, unknown> {
  switch (mode) {
    case "chain":
      return { colorscheme: "chain" };
    case "hydrophobicity":
      return { colorfunc: hydrophobicityColor };
    case "bfactor":
      return { colorscheme: { prop: "b", gradient: "roygb", min: 30, max: 90 } };
    default:
      return { color: "spectrum" };
  }
}

async function fetchStructure(pdbId: string, signal: AbortSignal) {
  const id = pdbId.toUpperCase();
  // Very large entries only exist as mmCIF, so fall back when .pdb is missing.
  for (const format of ["pdb", "cif"] as const) {
    const response = await fetch(`https://files.rcsb.org/download/${id}.${format}`, { signal });
    if (response.ok) return { text: await response.text(), format };
    if (response.status !== 404) break;
  }
  throw new Error(`Failed to load structure ${id}.`);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ProteinViewer({
  pdbId,
  pdbData,
  selectedResidue,
  highlightSelection,
  forcedChain,
  onResidueMap,
  onResidueClick,
  dsspResult,
  dsspResults,
}: ProteinViewerProps) {
  const dssp = useMemo(
    () => dsspResults ?? (dsspResult ? [dsspResult] : []),
    [dsspResults, dsspResult],
  );

  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<GLViewer | null>(null);
  const structureRef = useRef<{ text: string; format: "pdb" | "cif" } | null>(null);
  const zoomRequest = useRef(true);

  // Keep the latest callbacks without re-creating the viewer when parents pass new functions.
  const onResidueMapRef = useRef(onResidueMap);
  const onResidueClickRef = useRef(onResidueClick);
  useEffect(() => {
    onResidueMapRef.current = onResidueMap;
    onResidueClickRef.current = onResidueClick;
  });

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [representation, setRepresentation] = useState<Representation>("cartoon");
  const [colorMode, setColorMode] = useState<ColorMode>("default");
  const [showLigands, setShowLigands] = useState(false);
  const [showWater, setShowWater] = useState(false);
  const [chains, setChains] = useState<string[]>([]);
  const [selectedChain, setSelectedChain] = useState("all");
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [picked, setPicked] = useState<PickedResidue | null>(null);

  const effectiveChain = forcedChain ?? selectedChain;

  /* ───────── Load structure ───────── */
  useEffect(() => {
    const host = viewerRef.current;
    if (!host) return;

    let cancelled = false;
    const controller = new AbortController();

    setStatus("loading");
    setErrorMessage("");
    setReady(false);
    setPicked(null);
    setHover(null);

    const viewer = $3Dmol.createViewer(host, { backgroundColor: "#05070a" });
    viewerInstance.current = viewer;

    (async () => {
      try {
        let text: string;
        let format: "pdb" | "cif" = "pdb";

        if (pdbData) {
          text = pdbData;
        } else if (pdbId) {
          ({ text, format } = await fetchStructure(pdbId, controller.signal));
        } else {
          throw new Error("No PDB ID or PDB data provided.");
        }
        if (cancelled) return;

        structureRef.current = { text, format };
        viewer.addModel(text, format);

        // O(n) residue map (was O(n^2) via Array.some per atom).
        const residueMap: Record<string, ResidueInfo[]> = {};
        const seen = new Set<string>();
        for (const atom of viewer.getModel().selectedAtoms({})) {
          if (!atom.chain || atom.resi == null) continue;
          const key = `${atom.chain}:${atom.resi}`;
          if (seen.has(key)) continue;
          seen.add(key);
          (residueMap[atom.chain] ??= []).push({ resi: atom.resi, resn: atom.resn as string });
        }

        onResidueMapRef.current?.(residueMap);
        setChains(Object.keys(residueMap).sort());
        setSelectedChain("all");

        viewer.setHoverable(
          {},
          true,
          ((atom: AtomLike, _v: unknown, event: MouseEvent) => {
            const rect = host.getBoundingClientRect();
            const bfactor = typeof atom.b === "number" ? ` · B ${atom.b.toFixed(1)}` : "";
            setHover({
              text: `${atom.resn} ${atom.resi} · chain ${atom.chain} · ${atom.atom}${bfactor}`,
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
          }) as never,
          (() => setHover(null)) as never,
        );
        viewer.setClickable(
          {},
          true,
          ((atom: AtomLike) => {
            if (!atom.chain || atom.resi == null) return;
            const next = { chain: atom.chain, residue: atom.resi, resn: atom.resn ?? "" };
            setPicked(next);
            onResidueClickRef.current?.(next);
          }) as never,
        );

        zoomRequest.current = true;
        setReady(true);
        setStatus("ready");
      } catch (error) {
        if (cancelled || (error as Error).name === "AbortError") return;
        console.error("Failed to load protein:", error);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load structure.");
        setStatus("error");
      }
    })();

    const handleResize = () => viewer.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      controller.abort();
      window.removeEventListener("resize", handleResize);
      viewerInstance.current = null;
      try {
        viewer.clear();
        // Release the WebGL context; browsers cap live contexts (~16) and
        // repeated navigation otherwise leaks them.
        const canvas = (viewer as unknown as { getCanvas?: () => HTMLCanvasElement }).getCanvas?.();
        const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
        (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
        host.querySelectorAll("canvas").forEach((c) => c.remove());
      } catch {
        // best-effort cleanup
      }
    };
  }, [pdbId, pdbData]);

  /* ───────── Paint ─────────
   * Single render path: every control just changes state and this effect repaints. */
  useEffect(() => {
    const viewer = viewerInstance.current;
    if (!viewer || !ready) return;

    paintScene(viewer, {
      representation,
      chain: effectiveChain,
      colorMode,
      showLigands,
      showWater,
      dssp,
      highlightSelection,
      selectedResidue,
      picked,
    });

    if (zoomRequest.current && !highlightSelection && !selectedResidue) {
      viewer.zoomTo();
    }
    zoomRequest.current = false;
    viewer.render();
  }, [
    ready,
    representation,
    effectiveChain,
    colorMode,
    showLigands,
    showWater,
    dssp,
    highlightSelection,
    selectedResidue,
    picked,
  ]);

  function changeRepresentation(next: Representation) {
    zoomRequest.current = true;
    setRepresentation(next);
  }

  function changeChain(chain: string) {
    zoomRequest.current = true;
    setSelectedChain(chain);
  }

  function resetView() {
    viewerInstance.current?.zoomTo();
    viewerInstance.current?.render();
  }

  function savePng() {
    const viewer = viewerInstance.current;
    if (!viewer) return;
    viewer.render();
    const link = document.createElement("a");
    link.href = viewer.pngURI();
    link.download = `${(pdbId ?? "structure").toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function savePdb() {
    const structure = structureRef.current;
    if (!structure) return;
    downloadBlob(
      `${(pdbId ?? "structure").toLowerCase()}.${structure.format}`,
      new Blob([structure.text], { type: "text/plain" }),
    );
  }

  const modeHint = COLOR_MODES.find((m) => m.value === colorMode)?.hint;
  const buttonBase =
    "px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider outline-none transition focus-visible:ring-2 focus-visible:ring-white/40";
  const toggleClass = (on: boolean) =>
    `${buttonBase} ${on ? "bg-white text-black" : "bg-black/60 text-white/50 hover:bg-white/10 hover:text-white"}`;

  return (
    <div className="relative h-full min-h-[70vh] w-full">
      {/* 3D canvas host */}
      <div ref={viewerRef} className="absolute inset-0" />

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-mono text-xs text-white/40">
          LOADING STRUCTURE…
        </div>
      )}
      {status === "error" && (
        <div role="alert" className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center font-mono text-xs text-red-300/80">
          {errorMessage}
        </div>
      )}

      {hover && (
        <div
          className="pointer-events-none absolute z-30 whitespace-nowrap rounded border border-white/15 bg-black/80 px-2 py-1 font-mono text-[10px] text-white/80"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.text}
        </div>
      )}

      {/* Picked residue badge */}
      {picked && (
        <div className="absolute left-4 top-28 z-20 flex items-center gap-2 border border-amber-300/30 bg-black/70 px-2.5 py-1.5 font-mono text-[10px] text-amber-200 backdrop-blur sm:left-6 sm:top-32">
          {picked.resn} {picked.residue} · chain {picked.chain}
          <button
            onClick={() => setPicked(null)}
            aria-label="Clear picked residue"
            className="text-amber-200/60 outline-none hover:text-amber-100 focus-visible:ring-2 focus-visible:ring-amber-200/40"
          >
            ×
          </button>
        </div>
      )}

      {/* DSSP legend */}
      {dssp.length > 0 && colorMode === "default" && (
        <div className="absolute right-4 top-4 z-20 border border-white/10 bg-black/60 p-2.5 backdrop-blur sm:right-6 sm:top-6 sm:p-3">
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">DSSP</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:gap-x-4">
            <LegendItem color="#22d3ee" label="Helix" />
            <LegendItem color="#a78bfa" label="Sheet" />
            <LegendItem color="#fbbf24" label="Turn / Bend" />
            <LegendItem color="#94a3b8" label="Coil" />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute inset-x-4 bottom-4 z-20 flex flex-wrap items-center gap-2 sm:inset-x-6 sm:bottom-6">
        <ControlGroup label="VIEW">
          {(["cartoon", "surface", "stick"] as Representation[]).map((type) => (
            <button key={type} onClick={() => changeRepresentation(type)} className={toggleClass(representation === type)}>
              {type}
            </button>
          ))}
        </ControlGroup>

        <ControlGroup label="COLOR">
          <select
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value as ColorMode)}
            title={modeHint}
            aria-label="Color mode"
            className="bg-black/60 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/70 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {COLOR_MODES.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#05070a]">
                {m.label}
              </option>
            ))}
          </select>
        </ControlGroup>

        {/* Hidden when a parent page drives the chain (e.g. AI Insights' Subunit filter). */}
        {chains.length > 0 && !forcedChain && (
          <ControlGroup label="CHAIN">
            <button onClick={() => changeChain("all")} className={toggleClass(selectedChain === "all")}>
              ALL
            </button>
            {chains.map((chain) => (
              <button key={chain} onClick={() => changeChain(chain)} className={toggleClass(selectedChain === chain)}>
                {chain}
              </button>
            ))}
          </ControlGroup>
        )}

        <ControlGroup label="SHOW">
          <button onClick={() => setShowLigands((v) => !v)} aria-pressed={showLigands} className={toggleClass(showLigands)}>
            Ligands
          </button>
          <button onClick={() => setShowWater((v) => !v)} aria-pressed={showWater} className={toggleClass(showWater)}>
            Water
          </button>
        </ControlGroup>

        <ControlGroup label="EXPORT">
          <button onClick={savePng} className={toggleClass(false)}>PNG</button>
          <button onClick={savePdb} className={toggleClass(false)}>
            {structureRef.current?.format === "cif" ? "CIF" : "PDB"}
          </button>
        </ControlGroup>

        <button
          onClick={resetView}
          className="bg-black/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/50 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Reset
        </button>
      </div>

      <div className="absolute bottom-6 right-6 z-20 hidden font-mono text-[10px] text-white/30 xl:block">
        DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A RESIDUE
      </div>
    </div>
  );
}

interface PaintOptions {
  representation: Representation;
  chain: string;
  colorMode: ColorMode;
  showLigands: boolean;
  showWater: boolean;
  dssp: AnalysisResult[];
  highlightSelection?: HighlightSelection | null;
  selectedResidue?: { chain: string; residue: number } | null;
  picked: PickedResidue | null;
}

function paintScene(viewer: GLViewer, o: PaintOptions) {
  viewer.setStyle({}, {});
  viewer.removeAllSurfaces();

  try {
    applyRepresentation(viewer, o.representation, o.chain, o.colorMode);
  } catch (error) {
    console.error(`Failed to render ${o.representation}:`, error);
    viewer.setStyle({}, {});
    viewer.removeAllSurfaces();
    applyRepresentation(viewer, "cartoon", o.chain, o.colorMode);
  }

  const chainFilter = o.chain === "all" ? {} : { chain: o.chain };
  const WATER = ["HOH", "WAT", "DOD"];
  if (o.showLigands) {
    viewer.addStyle(
      { hetflag: true, not: { resn: WATER }, ...chainFilter } as never,
      { stick: { radius: 0.2, colorscheme: "greenCarbon" } } as never,
    );
  }
  if (o.showWater) {
    viewer.addStyle(
      { resn: WATER, ...chainFilter } as never,
      { sphere: { radius: 0.25, color: "#ef4444", opacity: 0.6 } } as never,
    );
  }

  // DSSP colors override the default rainbow only; an explicit color mode wins.
  if (o.colorMode === "default") applyAllDSSP(viewer, o.dssp, o.chain);

  if (o.picked) {
    viewer.addStyle(
      { chain: o.picked.chain, resi: o.picked.residue },
      { sphere: { radius: 0.5, color: "#fbbf24", opacity: 0.9 } },
    );
  }

  if (o.highlightSelection) {
    applyHighlightSelection(viewer, o.highlightSelection);
  } else if (o.selectedResidue) {
    applySelectedResidue(viewer, o.selectedResidue);
  }
}

function applyAllDSSP(
  viewer: GLViewer,
  results: AnalysisResult[],
  selectedChain: string,
) {
  for (const result of results) {
    applyDSSPStyles(viewer, result, selectedChain);
  }
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
  colorMode: ColorMode,
) {
  const selection = chain === "all" ? {} : { chain };
  const color = colorOption(colorMode);

  switch (representation) {
    case "cartoon":
      viewer.setStyle(selection, { cartoon: color } as never);
      break;
    case "stick":
      viewer.setStyle(
        selection,
        { stick: { radius: 0.15, ...(colorMode === "default" ? { colorscheme: "Jmol" } : color) } } as never,
      );
      break;
    case "surface":
      viewer.addSurface(
        $3Dmol.SurfaceType.VDW,
        colorMode === "default" ? { opacity: 0.85, color: "white" } : ({ opacity: 0.85, ...color } as never),
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
