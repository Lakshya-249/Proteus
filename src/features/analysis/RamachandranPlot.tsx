import { useMemo, useState } from "react";
import type { DSSPResidue } from "./useProteinAnalysis";

interface RamachandranPlotProps {
  residues: DSSPResidue[];
  chainId?: string;
  onResidueSelect?: (chain: string, residue: number) => void;
}

const SIZE = 320;
const PAD = 28;
const SPAN = SIZE - PAD * 2;

const HELIX = new Set(["H", "G", "I"]);
const SHEET = new Set(["E", "B"]);

/*
 * Rough, generous "allowed" boxes for general residues. These are an
 * approximation for quick triage, not a MolProbity-grade validation.
 */
function inAllowedRegion(phi: number, psi: number): boolean {
  const alphaR = phi >= -160 && phi <= -30 && psi >= -80 && psi <= 10;
  const beta = phi >= -180 && phi <= -45 && (psi >= 90 || psi <= -170);
  const alphaL = phi >= 30 && phi <= 90 && psi >= 0 && psi <= 90;
  const bridge = phi >= -180 && phi <= -45 && psi > 10 && psi < 90; // PPII / bridge region
  return alphaR || beta || alphaL || bridge;
}

const x = (phi: number) => PAD + ((phi + 180) / 360) * SPAN;
const y = (psi: number) => PAD + ((180 - psi) / 360) * SPAN;

const color = (ss: string) =>
  HELIX.has(ss) ? "#22d3ee" : SHEET.has(ss) ? "#a78bfa" : "#94a3b8";

export default function RamachandranPlot({
  residues,
  chainId,
  onResidueSelect,
}: RamachandranPlotProps) {
  const [hovered, setHovered] = useState<DSSPResidue | null>(null);

  const { points, outliers } = useMemo(() => {
    const pts = residues.filter(
      (r): r is DSSPResidue & { phi: number; psi: number } =>
        typeof r.phi === "number" && typeof r.psi === "number",
    );
    const out = pts.filter(
      (r) => r.resn !== "G" && r.resn !== "P" && !inAllowedRegion(r.phi, r.psi),
    );
    return { points: pts, outliers: out };
  }, [residues]);

  if (points.length === 0) return null;

  const outlierPct = (outliers.length / points.length) * 100;
  const ticks = [-180, -90, 0, 90, 180];

  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-white">Ramachandran Plot</div>
          <div className="mt-1 text-xs text-white/35">
            Backbone φ/ψ angles per residue. Click a point to focus it in 3D.
          </div>
        </div>
        <div className="text-right font-mono text-[11px] text-white/50">
          {outliers.length} outlier{outliers.length === 1 ? "" : "s"} ({outlierPct.toFixed(1)}%)
          <div className="text-[9px] text-white/25">approximate regions · Gly/Pro excluded</div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-[360px] shrink-0"
          role="img"
          aria-label={`Ramachandran plot with ${points.length} residues and ${outliers.length} outliers`}
        >
          <rect x={PAD} y={PAD} width={SPAN} height={SPAN} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.12)" />

          {/* approximate favoured regions */}
          <rect x={x(-160)} y={y(10)} width={x(-30) - x(-160)} height={y(-80) - y(10)} fill="rgba(34,211,238,0.07)" />
          <rect x={x(-180)} y={y(180)} width={x(-45) - x(-180)} height={y(90) - y(180)} fill="rgba(167,139,250,0.07)" />
          <rect x={x(30)} y={y(90)} width={x(90) - x(30)} height={y(0) - y(90)} fill="rgba(251,191,36,0.06)" />

          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={PAD} y2={SIZE - PAD} stroke="rgba(255,255,255,0.06)" />
              <line x1={PAD} x2={SIZE - PAD} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
              <text x={x(t)} y={SIZE - PAD + 14} fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.4)">{t}</text>
              <text x={PAD - 6} y={y(t) + 3} fontSize="9" textAnchor="end" fill="rgba(255,255,255,0.4)">{t}</text>
            </g>
          ))}
          <text x={SIZE / 2} y={SIZE - 2} fontSize="10" textAnchor="middle" fill="rgba(255,255,255,0.5)">φ (degrees)</text>
          <text x={8} y={SIZE / 2} fontSize="10" textAnchor="middle" fill="rgba(255,255,255,0.5)" transform={`rotate(-90 8 ${SIZE / 2})`}>ψ (degrees)</text>

          {points.map((r) => {
            const isOutlier = r.resn !== "G" && r.resn !== "P" && !inAllowedRegion(r.phi, r.psi);
            return (
              <circle
                key={`${r.resi}${r.icode ?? ""}`}
                cx={x(r.phi)}
                cy={y(r.psi)}
                r={isOutlier ? 3.6 : 2.4}
                fill={color(r.secondary_structure)}
                fillOpacity={isOutlier ? 1 : 0.75}
                stroke={isOutlier ? "#f87171" : "none"}
                strokeWidth={1.4}
                className={onResidueSelect && chainId ? "cursor-pointer" : undefined}
                onMouseEnter={() => setHovered(r)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => chainId && onResidueSelect?.(chainId, r.resi)}
              />
            );
          })}
        </svg>

        <div className="min-w-0 flex-1 text-xs text-white/50" aria-live="polite">
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
            <Legend c="#22d3ee" label="Helix" />
            <Legend c="#a78bfa" label="Sheet" />
            <Legend c="#94a3b8" label="Coil / turn" />
            <Legend c="#f87171" label="Outlier ring" />
          </div>
          {hovered ? (
            <div className="rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] text-white/70">
              {hovered.resn}
              {hovered.resi}
              {hovered.icode ?? ""} · φ {hovered.phi?.toFixed(0)}° ψ {hovered.psi?.toFixed(0)}°
              <div className="mt-1 text-white/35">DSSP: {hovered.secondary_structure || "C"}</div>
            </div>
          ) : (
            <div className="text-white/30">Hover a point for residue details.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function Legend({ c, label }: { c: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
      {label}
    </span>
  );
}
