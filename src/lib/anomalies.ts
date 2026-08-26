// Deterministic anomaly detection rules — no AI inference
import type { formatINR as _fi } from "./constants";

export type Anomaly = {
  id: string;
  scheme_name: string;
  district: string;
  state: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  detail: string;
  allocated_cr: number;
  released_cr: number;
  utilized_cr: number;
  physical_progress_pct: number;
  detected_at: string;
  recommended_action: string;
};

const TODAY = new Date();
// Current month index (0-based) in financial year (Apr=0)
function fyMonthElapsed(): number {
  const m = TODAY.getMonth(); // 0=Jan .. 11=Dec
  return m >= 3 ? m - 3 : m + 9; // Apr=0, Mar=11
}
const fyPctElapsed = Math.round((fyMonthElapsed() / 12) * 100);

export function detectAnomalies(rows: Record<string, unknown>[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Compute mean utilization across all rows for std-dev check
  const utPcts = rows.map((r) =>
    (r.allocated_cr as number) > 0
      ? ((r.utilized_cr as number) / (r.allocated_cr as number)) * 100
      : 0
  );
  const mean = utPcts.length ? utPcts.reduce((a, b) => a + b, 0) / utPcts.length : 0;
  const variance = utPcts.length
    ? utPcts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / utPcts.length
    : 0;
  const stdDev = Math.sqrt(variance);

  rows.forEach((row, idx) => {
    const allocated  = row.allocated_cr as number;
    const released   = row.released_cr  as number;
    const utilized   = row.utilized_cr  as number;
    const physical   = row.physical_progress_pct as number;
    const utilPct    = allocated > 0 ? (utilized / allocated) * 100 : 0;
    const financialPct = allocated > 0 ? (utilized / allocated) * 100 : 0;
    const releasedUtilGap = released > 0 ? ((released - utilized) / released) * 100 : 0;

    // Rule 1: Utilization < 30% when FY > 50% complete → HIGH
    if (fyPctElapsed > 50 && utilPct < 30) {
      anomalies.push({
        id: `r1-${row.id}`,
        scheme_name: row.scheme_name as string,
        district: row.district as string,
        state: row.state as string,
        severity: "HIGH",
        reason: "Potential implementation delay",
        detail: `Fund utilization is significantly below the expected level. Utilized ${utilPct.toFixed(1)}% with ${fyPctElapsed}% of the financial year elapsed.`,
        allocated_cr: allocated,
        released_cr: released,
        utilized_cr: utilized,
        physical_progress_pct: physical,
        detected_at: TODAY.toISOString(),
        recommended_action: "District administrator to review fund flow and implementation status. Conduct field inspection and submit utilization improvement plan within 30 days.",
      });
    }

    // Rule 3: Released-Utilized gap > 40% → MEDIUM
    else if (releasedUtilGap > 40 && released > 0) {
      anomalies.push({
        id: `r3-${row.id}`,
        scheme_name: row.scheme_name as string,
        district: row.district as string,
        state: row.state as string,
        severity: "MEDIUM",
        reason: "Unusual utilization pattern",
        detail: `Released-to-utilized gap is ${releasedUtilGap.toFixed(0)}% (Released: ${released} Cr, Utilized: ${utilized.toFixed(2)} Cr). Funds released but not being drawn down.`,
        allocated_cr: allocated,
        released_cr: released,
        utilized_cr: utilized,
        physical_progress_pct: physical,
        detected_at: TODAY.toISOString(),
        recommended_action: "Review implementation timeline. Verify that released funds are being properly accounted for in district records.",
      });
    }

    // Rule 4: Financial progress vs Physical progress difference > 25% → HIGH
    else if (Math.abs(financialPct - physical) > 25) {
      anomalies.push({
        id: `r4-${row.id}`,
        scheme_name: row.scheme_name as string,
        district: row.district as string,
        state: row.state as string,
        severity: "HIGH",
        reason: "Requires administrative review",
        detail: `Financial progress (${financialPct.toFixed(0)}%) and physical progress (${physical}%) diverge by ${Math.abs(financialPct - physical).toFixed(0)}%. This may indicate reporting inconsistency.`,
        allocated_cr: allocated,
        released_cr: released,
        utilized_cr: utilized,
        physical_progress_pct: physical,
        detected_at: TODAY.toISOString(),
        recommended_action: "Reconcile financial and physical progress records. Submit corrected progress report to state nodal agency.",
      });
    }

    // Rule 6: > 2 std deviations below district mean → HIGH
    else if (stdDev > 0 && (mean - utPcts[idx]) > 2 * stdDev) {
      anomalies.push({
        id: `r6-${row.id}`,
        scheme_name: row.scheme_name as string,
        district: row.district as string,
        state: row.state as string,
        severity: "HIGH",
        reason: "Unusual utilization pattern",
        detail: `District utilization (${utPcts[idx].toFixed(1)}%) is significantly below district average (${mean.toFixed(1)}%). Statistical outlier — more than 2σ below mean.`,
        allocated_cr: allocated,
        released_cr: released,
        utilized_cr: utilized,
        physical_progress_pct: physical,
        detected_at: TODAY.toISOString(),
        recommended_action: "Compare with peer districts. Assess if local implementation constraints require state-level support.",
      });
    }
  });

  // Sort by severity
  const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return anomalies.sort((a, b) => order[a.severity] - order[b.severity]);
}
