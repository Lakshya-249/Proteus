import { useState, useRef } from "react";

export interface ResidueMetric {
  resi: number;
  resn: string;
  chain: string;
  hydropathy: number;
  charge: -1 | 0 | 1;
  structure?: "H" | "E" | "C"; // Helix, Sheet, Coil
  isFunctional?: boolean;
}

type MetricType = "hydropathy" | "charge";

interface Props {
  data: ResidueMetric[];
  selectedResidue: number | null;
  onSelectResidue: (resi: number, chain: string) => void;
  metricType: MetricType;
}

/*
 * Value range per metric, used to scale the bars.
 * Hydropathy (Kyte-Doolittle) runs roughly -4.5 to 4.5.
 * Charge is just -1 / 0 / 1, so it gets a tighter range
 * so small bars are still visible.
 */
const METRIC_RANGE: Record<MetricType, number> = {
  hydropathy: 4.5,
  charge: 1.5,
};

function getMetricValue(
  d: ResidueMetric,
  metricType: MetricType,
): number {
  return metricType === "hydropathy"
    ? d.hydropathy
    : d.charge;
}

export default function SequenceMetricGraph({
  data,
  selectedResidue,
  onSelectResidue,
  metricType,
}: Props) {
  const [hoveredResi, setHoveredResi] =
    useState<ResidueMetric | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const itemWidth = 16;
  const height = 150;
  const pad = { top: 20, bottom: 40, left: 30, right: 30 };
  const totalWidth = Math.max(
    data.length * itemWidth + pad.left + pad.right,
    700,
  );

  const range = METRIC_RANGE[metricType];

  const getY = (val: number) => {
    const norm = (val + range) / (range * 2);
    return (
      height -
      pad.bottom -
      norm * (height - pad.top - pad.bottom)
    );
  };

  const getX = (idx: number) =>
    pad.left + idx * itemWidth + itemWidth / 2;

  const zeroY = getY(0);

  const activeItem =
    hoveredResi ||
    data.find((d) => d.resi === selectedResidue);

  // const activeValue = activeItem
  //   ? getMetricValue(activeItem, metricType)
  //   : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#04070d]/90 p-4 shadow-[0_0_50px_-12px_rgba(6,182,212,0.15)] backdrop-blur-md">
      {/* Background Tech Grid */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px]" />

      {/* Top HUD Display */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-2 w-2 items-center justify-center">
            <span className="absolute h-3 w-3 animate-ping rounded-full bg-cyan-400 opacity-40" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </div>
          <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-cyan-300">
            RESIDUE TOPOLOGY SCANNER
          </span>
        </div>

        {activeItem ? (
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="rounded bg-white/5 px-2 py-0.5 text-white/50">
              LOC:{" "}
              <strong className="text-white">
                {activeItem.chain}:{activeItem.resi}
              </strong>
            </span>
            <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
              TYPE: <strong>{activeItem.resn}</strong>
            </span>
            {metricType === "hydropathy" ? (
              <span className="rounded bg-violet-500/10 px-2 py-0.5 text-violet-300">
                HYDRO:{" "}
                <strong>
                  {activeItem.hydropathy.toFixed(1)}
                </strong>
              </span>
            ) : (
              <span
                className={`rounded px-2 py-0.5 ${
                  activeItem.charge > 0
                    ? "bg-sky-500/10 text-sky-300"
                    : activeItem.charge < 0
                      ? "bg-rose-500/10 text-rose-300"
                      : "bg-white/5 text-white/40"
                }`}
              >
                CHARGE:{" "}
                <strong>
                  {activeItem.charge > 0
                    ? "+1"
                    : activeItem.charge < 0
                      ? "-1"
                      : "0"}
                </strong>
              </span>
            )}
          </div>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
            [ SCRUB SEQUENCE TO PROBE MOLECULAR SURFACE ]
          </span>
        )}
      </div>

      {/* Interactive Canvas Track */}
      <div
        ref={containerRef}
        className="relative z-10 mt-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-cyan-500/20"
      >
        <svg width={totalWidth} height={height} className="select-none">
          <defs>
            <linearGradient id="neonGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#04070d" stopOpacity="0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>

          {/* Zero Datum Axis */}
          <line
            x1={pad.left}
            y1={zeroY}
            x2={totalWidth - pad.right}
            y2={zeroY}
            stroke="rgba(34, 211, 238, 0.2)"
            strokeDasharray="4 4"
          />

          {/* Equalizer Wave / Density Bars */}
          {data.map((d, i) => {
            const x = getX(i);
            const value = getMetricValue(d, metricType);
            const y = getY(value);
            const isHover = hoveredResi?.resi === d.resi;
            const isSelected = selectedResidue === d.resi;
            const isPos = value >= 0;

            return (
              <g
                key={d.resi}
                onClick={() => onSelectResidue(d.resi, d.chain)}
                className="cursor-pointer"
              >
                {/* Vertical Interactive Scanner Ray */}
                {(isHover || isSelected) && (
                  <rect
                    x={x - itemWidth / 2}
                    y={pad.top}
                    width={itemWidth}
                    height={height - pad.top}
                    fill="url(#neonGradient)"
                    className="transition-all duration-75"
                  />
                )}

                {/* Equalizer Bar */}
                <rect
                  x={x - 2}
                  y={isPos ? y : zeroY}
                  width={4}
                  height={Math.max(Math.abs(y - zeroY), 2)}
                  rx={2}
                  fill={isPos ? "#22d3ee" : "#f43f5e"}
                  opacity={isSelected || isHover ? 1 : 0.45}
                  filter={
                    isSelected || isHover
                      ? "url(#glow)"
                      : undefined
                  }
                />

                {/* Secondary Structure Indicator Pill at Bottom */}
                <rect
                  x={x - itemWidth / 2 + 1}
                  y={height - pad.bottom + 6}
                  width={itemWidth - 2}
                  height={4}
                  rx={1}
                  fill={
                    d.structure === "H"
                      ? "#22d3ee" // Helix
                      : d.structure === "E"
                        ? "#a78bfa" // Sheet
                        : "#334155" // Coil / Loop
                  }
                  opacity={0.8}
                />

                {/* Functional Hotspot Beacon Dot */}
                {d.isFunctional && (
                  <circle
                    cx={x}
                    cy={pad.top + 2}
                    r={2.5}
                    fill="#fbbf24"
                    filter="url(#glow)"
                  />
                )}

                {/* Amino Acid Code */}
                <text
                  x={x}
                  y={height - pad.bottom + 24}
                  textAnchor="middle"
                  className={`font-mono text-[9px] transition-colors ${
                    isSelected
                      ? "fill-cyan-300 font-bold"
                      : isHover
                        ? "fill-white"
                        : "fill-white/30"
                  }`}
                >
                  {d.resn}
                </text>

                {/* Invisible Broad Click Mask */}
                <rect
                  x={x - itemWidth / 2}
                  y={0}
                  width={itemWidth}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHoveredResi(d)}
                  onMouseLeave={() => setHoveredResi(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend Bar */}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 font-mono text-[9px] text-white/40">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-xs bg-[#22d3ee]" /> α-Helix
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-xs bg-[#a78bfa]" /> β-Sheet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" /> Active / Binding Site
          </span>
        </div>
        <span>CLICK NODE TO LOCK 3D CAMERA</span>
      </div>
    </div>
  );
}
