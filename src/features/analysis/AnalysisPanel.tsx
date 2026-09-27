import { useMemo } from "react";
import type {
  AnalysisResult,
  DSSPResidue,
} from "./useProteinAnalysis";

interface AnalysisPanelProps {
  pdbId: string;
  sequence?: string;
  chainId?: string;

  result: AnalysisResult | null;
  loading: boolean;
  error: string;

  onRunAnalysis: () => void;

  onResidueSelect?: (
    chain: string,
    residue: number,
  ) => void;
}

function AnalysisPanel({
  pdbId,
  sequence,
  chainId,
  result,
  loading,
  error,
  onRunAnalysis,
  onResidueSelect,
}: AnalysisPanelProps) {
  const statistics = useMemo(() => {
    if (!result) return null;

    const residues = result.residues;

    const total = residues.length;

    const helix = residues.filter((r) =>
      ["H", "G", "I"].includes(
        r.secondary_structure,
      ),
    ).length;

    const sheet = residues.filter((r) =>
      ["E", "B"].includes(
        r.secondary_structure,
      ),
    ).length;

    const coil = total - helix - sheet;

    const accessible = residues.filter(
      (r) => r.accessibility >= 25,
    ).length;

    const buried = total - accessible;

    return {
      total,
      helix,
      sheet,
      coil,
      accessible,
      buried,
      helixPct: percentage(helix, total),
      sheetPct: percentage(sheet, total),
      coilPct: percentage(coil, total),
      accessiblePct: percentage(
        accessible,
        total,
      ),
      buriedPct: percentage(
        buried,
        total,
      ),
    };
  }, [result]);

  if (!sequence) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-white/40">
        No sequence available for analysis.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-400/70">
          Structural Analysis
        </div>

        <h2 className="text-xl font-medium text-white sm:text-2xl">
          DSSP
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
          Analyze the experimentally determined protein
          structure to identify secondary structure and
          residue-level solvent accessibility.
        </p>
      </div>

      {/* Method */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:mb-8 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">
              Secondary Structure & Accessibility
            </div>

            <div className="mt-1 font-mono text-[10px] text-white/30">
              {pdbId.toUpperCase()} · CHAIN{" "}
              {chainId ?? "—"} · {sequence.length} RESIDUES
            </div>
          </div>

          <div className="shrink-0 rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] text-white/40">
            STRUCTURAL METHOD
          </div>
        </div>

        <button
          type="button"
          onClick={onRunAnalysis}
          disabled={loading}
          className="w-full rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-5 py-2.5 text-xs font-medium text-cyan-300 outline-none transition hover:bg-cyan-400/15 focus-visible:ring-2 focus-visible:ring-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {loading
            ? "Analyzing..."
            : result
              ? "Run Again"
              : "Run Analysis"}
        </button>

        {error && (
          <div className="mt-4 rounded-lg border border-red-400/10 bg-red-400/5 p-3 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>

      {result && statistics ? (
        <>
          {/* Overview */}
          <div className="mb-6">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
              Structural Overview
            </div>

            <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
              <Metric
                label="Residues"
                value={statistics.total.toString()}
              />

              <Metric
                label="Helix"
                value={`${statistics.helixPct}%`}
              />

              <Metric
                label="Sheet"
                value={`${statistics.sheetPct}%`}
              />
            </div>
          </div>

          {/* Secondary structure */}
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
            <div className="mb-5">
              <div className="text-sm font-medium text-white">
                Secondary Structure
              </div>

              <div className="mt-1 text-xs text-white/35">
                Distribution of DSSP structural assignments.
              </div>
            </div>

            <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-white/5">
              <div
                className="bg-cyan-400/70"
                style={{
                  width: `${statistics.helixPct}%`,
                }}
              />

              <div
                className="bg-violet-400/70"
                style={{
                  width: `${statistics.sheetPct}%`,
                }}
              />

              <div
                className="bg-white/20"
                style={{
                  width: `${statistics.coilPct}%`,
                }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StructureStat
                label="α-Helix"
                value={statistics.helix}
                percentage={statistics.helixPct}
                indicator="bg-cyan-400/70"
              />

              <StructureStat
                label="β-Sheet"
                value={statistics.sheet}
                percentage={statistics.sheetPct}
                indicator="bg-violet-400/70"
              />

              <StructureStat
                label="Coil / Other"
                value={statistics.coil}
                percentage={statistics.coilPct}
                indicator="bg-white/20"
              />
            </div>
          </section>

          {/* Accessibility */}
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
            <div className="mb-5">
              <div className="text-sm font-medium text-white">
                Solvent Accessibility
              </div>

              <div className="mt-1 text-xs text-white/35">
                Residues grouped by accessibility.
              </div>
            </div>

            <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-white/5">
              <div
                className="bg-emerald-400/60"
                style={{
                  width: `${statistics.accessiblePct}%`,
                }}
              />

              <div
                className="bg-white/15"
                style={{
                  width: `${statistics.buriedPct}%`,
                }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <AccessibilityStat
                label="Exposed"
                value={statistics.accessible}
                percentage={
                  statistics.accessiblePct
                }
                indicator="bg-emerald-400/60"
              />

              <AccessibilityStat
                label="Buried"
                value={statistics.buried}
                percentage={statistics.buriedPct}
                indicator="bg-white/20"
              />
            </div>
          </section>

          {/* Residue table */}
          <ResidueTable
            residues={result.residues}
            chainId={chainId}
            onResidueSelect={onResidueSelect}
          />
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <AnalysisCard
            title="Secondary Structure"
            description="Per-residue helix, sheet and coil assignments."
          />

          <AnalysisCard
            title="Solvent Accessibility"
            description="Residue-level accessible surface area."
          />
        </div>
      )}

      {/* Method */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          Method
        </div>

        <p className="text-sm leading-6 text-white/45">
          DSSP assigns secondary structure and calculates
          solvent accessibility directly from the atomic
          coordinates of a protein structure.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Tag>DSSP</Tag>
          <Tag>Structure-based</Tag>
          <Tag>Secondary structure</Tag>
          <Tag>Accessibility</Tag>
          <Tag>Residue-level</Tag>
        </div>
      </div>
    </div>
  );
}

function ResidueTable({
  residues,
  chainId,
  onResidueSelect,
}: {
  residues: DSSPResidue[];
  chainId?: string;
  onResidueSelect?: (
    chain: string,
    residue: number,
  ) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          Residue Analysis
        </div>

        <div className="mt-1 text-xs text-white/30">
          Select a residue to inspect it in the 3D structure.
        </div>
      </div>

      <div className="max-h-96 overflow-auto">
        <table className="w-full min-w-[420px] text-left">
          <thead className="sticky top-0 bg-[#080a0d]">
            <tr className="border-b border-white/10 font-mono text-[9px] uppercase tracking-wider text-white/30">
              <th className="px-4 py-3 sm:px-5">
                Residue
              </th>

              <th className="px-4 py-3 sm:px-5">
                AA
              </th>

              <th className="px-4 py-3 sm:px-5">
                Structure
              </th>

              <th className="px-4 py-3 sm:px-5">
                ASA
              </th>
            </tr>
          </thead>

          <tbody>
            {residues.map((residue) => (
              <tr
                key={residue.resi}
                onClick={() => {
                  if (!chainId) return;

                  onResidueSelect?.(
                    chainId,
                    residue.resi,
                  );
                }}
                className="cursor-pointer border-b border-white/5 text-xs transition hover:bg-cyan-400/[0.05]"
              >
                <td className="px-4 py-3 font-mono text-white/60 sm:px-5">
                  {residue.resi}
                </td>

                <td className="px-4 py-3 font-mono text-cyan-300/70 sm:px-5">
                  {residue.resn}
                </td>

                <td className="px-4 py-3 sm:px-5">
                  <StructureBadge
                    value={
                      residue.secondary_structure
                    }
                  />
                </td>

                <td className="px-4 py-3 font-mono text-white/50 sm:px-5">
                  {residue.accessibility}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">
        {label}
      </div>

      <div className="mt-2 text-xl font-light text-white sm:text-2xl">
        {value}
      </div>
    </div>
  );
}

function StructureStat({
  label,
  value,
  percentage,
  indicator,
}: {
  label: string;
  value: number;
  percentage: number;
  indicator: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/10 p-4">
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${indicator}`}
        />

        <span className="text-xs text-white/50">
          {label}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <span className="text-lg text-white/70">
          {value}
        </span>

        <span className="font-mono text-[10px] text-white/30">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

function AccessibilityStat({
  label,
  value,
  percentage,
  indicator,
}: {
  label: string;
  value: number;
  percentage: number;
  indicator: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/10 p-4">
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${indicator}`}
        />

        <span className="text-xs text-white/50">
          {label}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <span className="text-lg text-white/70">
          {value}
        </span>

        <span className="font-mono text-[10px] text-white/30">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

function AnalysisCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="mb-2 text-sm font-medium text-white">
        {title}
      </div>

      <p className="text-xs leading-5 text-white/35">
        {description}
      </p>

      <div className="mt-6 h-20 rounded-lg border border-dashed border-white/10 bg-black/10" />
    </div>
  );
}

function StructureBadge({
  value,
}: {
  value: string;
}) {
  const labels: Record<string, string> = {
    H: "α-Helix",
    G: "3₁₀ Helix",
    I: "π-Helix",
    E: "β-Sheet",
    B: "β-Bridge",
    T: "Turn",
    S: "Bend",
    P: "PPII Helix",
    C: "Coil",
  };

  return (
    <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-white/50">
      {labels[value] ?? "Coil"}
    </span>
  );
}

function Tag({
  children,
}: {
  children: string;
}) {
  return (
    <span className="rounded-md border border-white/10 px-2 py-1 font-mono text-[9px] text-white/35">
      {children}
    </span>
  );
}

function percentage(
  value: number,
  total: number,
): number {
  if (total === 0) return 0;

  return Math.round(
    (value / total) * 100,
  );
}

export default AnalysisPanel;
