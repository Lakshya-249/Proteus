import { useMemo } from "react";
import RamachandranPlot from "./RamachandranPlot";
import type {
  AnalysisResult,
  DSSPResidue,
} from "./useProteinAnalysis";

interface AnalysisPanelProps {
  /** RCSB entry ID. Used as the title when no label is given. */
  pdbId?: string;

  /** Title shown in the header, e.g. "Designed complex" or a file name. */
  label?: string;

  sequence?: string;

  /** Residue count, for structures that have no single sequence string. */
  residueCount?: number;

  chainId?: string;

  /** Chains that can be analysed. Shows a chain selector when given. */
  chains?: string[];

  /** Chains that already have results (marked in the selector). */
  analyzedChains?: string[];

  onChainChange?: (chain: string) => void;

  /** Adds an "Analyze all chains" button. */
  onRunAll?: () => void;

  /**
   * Intended secondary structure of the active chain (H / E / C / T per
   * residue). When given, DSSP is compared against it.
   */
  designedStructure?: string;

  result: AnalysisResult | null;
  loading: boolean;
  error: string;

  onRunAnalysis: () => void;

  onResidueSelect?: (
    chain: string,
    residue: number,
  ) => void;
}

const HELIX_CODES = new Set(["H", "G", "I"]);
const SHEET_CODES = new Set(["E", "B"]);

function AnalysisPanel({
  pdbId,
  label,
  sequence,
  residueCount,
  chainId,
  chains,
  analyzedChains,
  onChainChange,
  onRunAll,
  designedStructure,
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
      HELIX_CODES.has(r.secondary_structure),
    ).length;

    const sheet = residues.filter((r) =>
      SHEET_CODES.has(r.secondary_structure),
    ).length;

    const coil = total - helix - sheet;

    // "Exposed" means >= 25% of the residue's maximum surface area. The raw
    // DSSP value is absolute (A^2), so comparing it to 25 mislabelled most residues.
    const accessible = residues.filter(
      (r) => (r.rel_accessibility ?? (r.accessibility / 190) * 100) >= 25,
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

  const agreement = useMemo(
    () => compareWithDesign(result, designedStructure),
    [result, designedStructure],
  );

  const title = label ?? pdbId?.toUpperCase() ?? "Structure";
  const total = residueCount ?? sequence?.length ?? 0;

  if (!sequence && !residueCount) {
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
          Identify secondary structure and
          residue-level solvent accessibility
          from the atomic coordinates of a
          protein structure.
        </p>
      </div>

      {/* Method */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:mb-8 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">
              Secondary Structure & Accessibility
            </div>

            <div className="mt-1 truncate font-mono text-[10px] text-white/30">
              {title} · CHAIN{" "}
              {chainId ?? "—"} · {total} RESIDUES
            </div>
          </div>

          <div className="shrink-0 rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] text-white/40">
            STRUCTURAL METHOD
          </div>
        </div>

        {chains && chains.length > 1 && (
          <div className="mb-5">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-white/30">
              Chain
            </div>

            <div className="flex flex-wrap gap-2">
              {chains.map((chain) => {
                const active = chain === chainId;
                const done = analyzedChains?.includes(chain);

                return (
                  <button
                    key={chain}
                    type="button"
                    onClick={() => onChainChange?.(chain)}
                    aria-pressed={active}
                    className={[
                      "flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300/40",
                      active
                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                        : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    {chain}

                    {done && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                        title="Analysed"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onRunAnalysis}
            disabled={loading}
            className="w-full rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-5 py-2.5 text-xs font-medium text-cyan-300 outline-none transition hover:bg-cyan-400/15 focus-visible:ring-2 focus-visible:ring-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {loading
              ? "Analyzing..."
              : result
                ? chains && chains.length > 1
                  ? `Run chain ${chainId} again`
                  : "Run again"
                : chains && chains.length > 1
                  ? `Analyze chain ${chainId}`
                  : "Run analysis"}
          </button>

          {onRunAll && chains && chains.length > 1 && (
            <button
              type="button"
              onClick={onRunAll}
              disabled={loading}
              className="w-full rounded-lg border border-white/10 px-5 py-2.5 text-xs font-medium text-white/60 outline-none transition hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Analyze all {chains.length} chains
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 whitespace-pre-line rounded-lg border border-red-400/10 bg-red-400/5 p-3 text-xs leading-5 text-red-400">
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

          {/* Design check */}
          {agreement && (
            <section className="mb-6 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.03] p-4 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">
                    Design check
                  </div>

                  <div className="mt-1 max-w-md text-xs leading-5 text-white/40">
                    How closely DSSP&apos;s result
                    matches the helix, sheet and
                    coil you painted for this chain.
                  </div>
                </div>

                <div className="text-3xl font-light text-cyan-200">
                  {agreement.overallPct}%
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <RecoveryStat
                  label="Helix as designed"
                  hit={agreement.helix.hit}
                  of={agreement.helix.of}
                />

                <RecoveryStat
                  label="Sheet as designed"
                  hit={agreement.sheet.hit}
                  of={agreement.sheet.of}
                />

                <RecoveryStat
                  label="Coil as designed"
                  hit={agreement.coil.hit}
                  of={agreement.coil.of}
                />
              </div>
            </section>
          )}

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

            <ResidueStrip residues={result.residues} />

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

          {/* Ramachandran */}
          <RamachandranPlot
            residues={result.residues}
            chainId={chainId}
            onResidueSelect={onResidueSelect}
          />

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

interface Recovery {
  hit: number;
  of: number;
}

interface DesignAgreement {
  overallPct: number;
  helix: Recovery;
  sheet: Recovery;
  coil: Recovery;
}

/*
 * Compares DSSP output with the designed H/E/C/T string at the
 * three-state level (helix / sheet / everything else). Only meaningful when
 * both describe the same residues, so a length mismatch returns null.
 */
function compareWithDesign(
  result: AnalysisResult | null,
  designed: string | undefined,
): DesignAgreement | null {
  if (
    !result ||
    !designed ||
    designed.length !== result.residues.length
  ) {
    return null;
  }

  const helix = { hit: 0, of: 0 };
  const sheet = { hit: 0, of: 0 };
  const coil = { hit: 0, of: 0 };

  result.residues.forEach((residue, index) => {
    const observed = HELIX_CODES.has(residue.secondary_structure)
      ? "H"
      : SHEET_CODES.has(residue.secondary_structure)
        ? "E"
        : "C";

    const intended =
      designed[index] === "H" || designed[index] === "E"
        ? designed[index]
        : "C";

    const bucket =
      intended === "H" ? helix : intended === "E" ? sheet : coil;

    bucket.of++;
    if (observed === intended) bucket.hit++;
  });

  const hits = helix.hit + sheet.hit + coil.hit;

  return {
    overallPct: percentage(hits, result.residues.length),
    helix,
    sheet,
    coil,
  };
}

function RecoveryStat({
  label,
  hit,
  of,
}: {
  label: string;
  hit: number;
  of: number;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/10 p-4">
      <div className="text-xs text-white/50">{label}</div>

      <div className="mt-3 flex items-end justify-between">
        <span className="text-lg text-white/70">
          {of === 0 ? "—" : `${hit} / ${of}`}
        </span>

        {of > 0 && (
          <span className="font-mono text-[10px] text-white/30">
            {percentage(hit, of)}%
          </span>
        )}
      </div>
    </div>
  );
}

/*
 * One coloured tick per residue, in sequence order.
 */
function ResidueStrip({
  residues,
}: {
  residues: DSSPResidue[];
}) {
  return (
    <div
      className="mb-5 flex h-6 overflow-hidden rounded-md bg-white/5"
      role="img"
      aria-label="Secondary structure of each residue, in sequence order"
    >
      {residues.map((residue, index) => {
        const code = residue.secondary_structure;

        const color = HELIX_CODES.has(code)
          ? "bg-cyan-400/70"
          : SHEET_CODES.has(code)
            ? "bg-violet-400/70"
            : "bg-white/15";

        return (
          <div
            key={index}
            title={`${residue.resn} ${residue.resi}`}
            className={`h-full min-w-px flex-1 ${color}`}
          />
        );
      })}
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

              <th className="px-4 py-3 sm:px-5">
                Rel. %
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

                <td className="px-4 py-3 font-mono text-white/50 sm:px-5">
                  {residue.rel_accessibility != null
                    ? `${residue.rel_accessibility.toFixed(0)}%`
                    : "—"}
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
