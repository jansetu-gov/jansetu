import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { COLORS, DEMO_BADGE, FINANCIAL_YEARS, STATES_DISTRICTS, formatINR } from "@/lib/constants";
import { fetchDistrictData } from "@/db/api";

type ChartTab = "allocated" | "monthly" | "progress" | "compare";

const CHART_TABS: { key: ChartTab; label: string }[] = [
  { key: "allocated", label: "Alloc vs Used" },
  { key: "monthly", label: "Monthly Trend" },
  { key: "progress", label: "Fin vs Physical" },
  { key: "compare", label: "District Compare" },
];

export default function OfficerCharts() {
  const router = useRouter();

  const [selectedState, setSelectedState]       = useState("Assam");
  const [selectedDistrict, setSelectedDistrict] = useState("Kamrup");
  const [selectedFY, setSelectedFY]             = useState("2024-25");
  const [activeTab, setActiveTab]               = useState<ChartTab>("allocated");
  const [districtData, setDistrictData]         = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]                   = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchDistrictData(selectedState, selectedDistrict, undefined, selectedFY)
        .then(setDistrictData)
        .finally(() => setLoading(false));
    }, [selectedState, selectedDistrict, selectedFY])
  );

  // ── Allocated vs Released vs Utilized ─────────────────────
  const allocData = districtData.slice(0, 5).map((r, i) => ({
    x: i + 1,
    label: ((r.scheme_name as string) ?? "").slice(0, 12),
    alloc: r.allocated_cr as number,
    released: r.released_cr as number,
    utilized: r.utilized_cr as number,
  }));

  // ── Monthly Trend (pick first row) ──────────────────────────
  const firstRow = districtData[0];
  const monthlyRaw = firstRow ? (firstRow.monthly_data as { month: string; utilized: number }[] | null) ?? [] : [];
  const monthlyData = monthlyRaw.map((m) => ({ x: m.month.slice(0, 3), y: m.utilized }));

  // ── Financial vs Physical ──────────────────────────────────
  const progressData = districtData.slice(0, 5).map((r, i) => ({
    x: i + 1,
    fin: (r.allocated_cr as number) > 0
      ? Math.round(((r.utilized_cr as number) / (r.allocated_cr as number)) * 100)
      : 0,
    phy: r.physical_progress_pct as number,
  }));

  // ── District Compare (multiple districts same state) ────────
  const [compareData, setCompareData]   = useState<Record<string, unknown>[]>([]);
  const [compareLoading, setCmpLoading] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (activeTab !== "compare") return;
      setCmpLoading(true);
      fetchDistrictData(selectedState, undefined, undefined, selectedFY)
        .then((rows) => {
          // Aggregate by district
          const byDistrict: Record<string, { alloc: number; utilized: number }> = {};
          rows.forEach((r) => {
            const d = r.district as string;
            byDistrict[d] = byDistrict[d] ?? { alloc: 0, utilized: 0 };
            byDistrict[d].alloc    += r.allocated_cr as number;
            byDistrict[d].utilized += r.utilized_cr  as number;
          });
          setCompareData(
            Object.entries(byDistrict).map(([district, v], i) => ({
              x: i + 1,
              label: district.slice(0, 10),
              utilPct: v.alloc > 0 ? Math.round((v.utilized / v.alloc) * 100) : 0,
            }))
          );
        })
        .finally(() => setCmpLoading(false));
    }, [activeTab, selectedState, selectedFY])
  );

  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 bg-card border-b border-border flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={8}><ArrowLeft size={22} color={COLORS.navy} /></Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">Charts & Analytics</Text>
          <Text className="text-xs text-muted-foreground">{selectedDistrict}, {selectedState} · {selectedFY}</Text>
        </View>
        <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${COLORS.primary}15` }}>
          <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>{DEMO_BADGE}</Text>
        </View>
      </View>

      {/* Filters */}
      <View className="px-4 pt-3 pb-2 bg-card border-b border-border gap-2">
        <FilterRow label="State"    options={Object.keys(STATES_DISTRICTS)} selected={selectedState}    onSelect={(v) => { setSelectedState(v); setSelectedDistrict(STATES_DISTRICTS[v][0]); }} />
        <FilterRow label="District" options={STATES_DISTRICTS[selectedState] ?? []} selected={selectedDistrict} onSelect={setSelectedDistrict} />
        <FilterRow label="FY"       options={FINANCIAL_YEARS} selected={selectedFY} onSelect={setSelectedFY} />
      </View>

      {/* Chart Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-3 border-b border-border">
        <View className="flex-row gap-2">
          {CHART_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="px-4 py-2 rounded-sm border"
              style={{
                backgroundColor: activeTab === tab.key ? COLORS.primary : "#fff",
                borderColor: activeTab === tab.key ? COLORS.primary : COLORS.border,
              }}
            >
              <Text className="text-sm font-semibold" style={{ color: activeTab === tab.key ? "#fff" : COLORS.navy }}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <View className="py-16 items-center">
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <View className="px-4 py-5">
          {/* ── Allocated vs Released vs Utilized ───────────── */}
          {activeTab === "allocated" && (
            <View>
              <Text className="text-sm font-bold text-foreground mb-1">Allocated vs Released vs Utilized (₹ Cr)</Text>
              <Text className="text-xs text-muted-foreground mb-3">{selectedDistrict} · Top 5 schemes</Text>
              {allocData.length === 0 ? <EmptyChart /> : (
                <View className="bg-card border border-border rounded-sm p-3">
                  <View className="flex-row gap-4 justify-center mb-3">
                    {([["Allocated", COLORS.navy], ["Released", "#1565C0"], ["Utilized", "#2E7D32"]] as [string,string][]).map(([l, c]) => (
                      <View key={l} className="flex-row items-center gap-1">
                        <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                        <Text className="text-xs text-muted-foreground">{l}</Text>
                      </View>
                    ))}
                  </View>
                  <SchemeSummaryTable data={allocData} />
                </View>
              )}
            </View>
          )}

          {/* ── Monthly Trend ─────────────────────────────────── */}
          {activeTab === "monthly" && (
            <View>
              <Text className="text-sm font-bold text-foreground mb-1">Monthly Utilization Trend (₹ Cr)</Text>
              <Text className="text-xs text-muted-foreground mb-3">
                {firstRow ? (firstRow.scheme_name as string) : selectedDistrict} · {selectedFY}
              </Text>
              {monthlyData.length === 0 ? <EmptyChart /> : (
                <View className="bg-card border border-border rounded-sm p-3">
                  <NativeBarChart data={monthlyData} color={COLORS.primary} height={160} />
                  <Text className="text-xs text-muted-foreground text-center mt-2">
                    Peak: {formatINR(Math.max(...monthlyData.map((d) => d.y)))} Cr
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Financial vs Physical ─────────────────────────── */}
          {activeTab === "progress" && (
            <View>
              <Text className="text-sm font-bold text-foreground mb-1">Financial vs Physical Progress (%)</Text>
              <Text className="text-xs text-muted-foreground mb-3">{selectedDistrict} · Top 5 schemes</Text>
              {progressData.length === 0 ? <EmptyChart /> : (
                <View className="bg-card border border-border rounded-sm p-3">
                  <View className="flex-row gap-4 justify-center mb-3">
                    {([["Financial %", COLORS.primary], ["Physical %", "#2E7D32"]] as [string,string][]).map(([l, c]) => (
                      <View key={l} className="flex-row items-center gap-1">
                        <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                        <Text className="text-xs text-muted-foreground">{l}</Text>
                      </View>
                    ))}
                  </View>
                  {progressData.map((d, i) => (
                    <View key={i} className="mb-3">
                      <Text className="text-xs text-muted-foreground mb-1">Scheme {i + 1}</Text>
                      <DualProgressBar fin={d.fin} phy={d.phy} />
                    </View>
                  ))}
                  {progressData.some((d) => Math.abs(d.fin - d.phy) > 25) && (
                    <View className="mt-2 p-2 rounded-sm" style={{ backgroundColor: `${COLORS.brickRed}10` }}>
                      <Text className="text-xs" style={{ color: COLORS.brickRed }}>
                        {'⚠️'} One or more schemes show {'>'}25% divergence between financial and physical progress.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── District Compare ──────────────────────────────── */}
          {activeTab === "compare" && (
            <View>
              <Text className="text-sm font-bold text-foreground mb-1">District-wise Utilization — {selectedState}</Text>
              <Text className="text-xs text-muted-foreground mb-3">All districts · {selectedFY}</Text>
              {compareLoading ? (
                <View className="py-8 items-center"><ActivityIndicator color={COLORS.primary} /></View>
              ) : compareData.length === 0 ? <EmptyChart /> : (
                <View className="bg-card border border-border rounded-sm p-3">
                  {(compareData as Array<{ x: number; label: string; utilPct: number }>).map((d, i) => {
                    const barColor = d.utilPct < 40 ? COLORS.brickRed : d.utilPct < 70 ? COLORS.warning : "#2E7D32";
                    return (
                      <View key={i} className="mb-2">
                        <View className="flex-row justify-between mb-0.5">
                          <Text className="text-xs text-foreground">{d.label}</Text>
                          <Text className="text-xs font-bold" style={{ color: barColor }}>{d.utilPct}%</Text>
                        </View>
                        <View className="h-4 bg-muted rounded-sm overflow-hidden">
                          <View style={{ width: `${Math.min(100, d.utilPct)}%`, height: 16, backgroundColor: barColor, borderRadius: 2 }} />
                        </View>
                      </View>
                    );
                  })}
                  <Text className="text-xs text-muted-foreground text-center mt-2">
                    Red = below 40% · Amber = 40–70% · Green = above 70%
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ── Native chart helpers (no external chart lib needed) ────────────────────

function NativeBarChart({ data, color, height = 160 }: { data: { x: string; y: number }[]; color: string; height?: number }) {
  const maxVal = Math.max(...data.map((d) => d.y), 0.01);
  return (
    <View style={{ height }} className="flex-row items-end gap-0.5 px-1">
      {data.map((d, i) => {
        const barH = Math.max(4, (d.y / maxVal) * (height - 28));
        return (
          <View key={i} className="flex-1 items-center">
            {d.y > 0 && <Text style={{ color: COLORS.muted, fontSize: 7 }} numberOfLines={1}>{d.y.toFixed(1)}</Text>}
            <View style={{ height: barH, backgroundColor: color, borderRadius: 2, width: "100%" }} />
            <Text style={{ color: COLORS.muted, fontSize: 8 }} numberOfLines={1}>{d.x}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DualProgressBar({ fin, phy }: { fin: number; phy: number }) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <Text className="text-xs w-14" style={{ color: COLORS.primary }}>Fin {fin}%</Text>
        <View className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
          <View style={{ width: `${Math.min(100, fin)}%`, height: 12, backgroundColor: COLORS.primary }} />
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="text-xs w-14" style={{ color: "#2E7D32" }}>Phy {phy}%</Text>
        <View className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
          <View style={{ width: `${Math.min(100, phy)}%`, height: 12, backgroundColor: "#2E7D32" }} />
        </View>
      </View>
    </View>
  );
}

function FilterRow({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-xs text-muted-foreground w-14">{label}:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-1.5">
          {options.map((opt) => (
            <Pressable key={opt} onPress={() => onSelect(opt)} className="px-2.5 py-1 rounded-sm border"
              style={{ backgroundColor: selected === opt ? COLORS.primary : "#fff", borderColor: selected === opt ? COLORS.primary : COLORS.border }}>
              <Text className="text-xs font-semibold" style={{ color: selected === opt ? "#fff" : COLORS.navy }}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function EmptyChart() {
  return (
    <View className="py-12 items-center bg-card border border-border rounded-sm">
      <Text className="text-muted-foreground text-sm">No data available for selected filters</Text>
    </View>
  );
}

function SchemeSummaryTable({ data }: { data: Array<{ label: string; alloc: number; released: number; utilized: number }> }) {
  return (
    <View className="mt-1">
      {data.map((d, i) => {
        const pct = d.alloc > 0 ? Math.round((d.utilized / d.alloc) * 100) : 0;
        const barColor = pct < 40 ? COLORS.brickRed : pct < 70 ? COLORS.warning : "#2E7D32";
        return (
          <View key={i} className="mb-3">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs text-foreground flex-1 pr-2" numberOfLines={1}>{i + 1}. {d.label}</Text>
              <Text className="text-xs font-bold" style={{ color: barColor }}>{pct}%</Text>
            </View>
            {([["Alloc", d.alloc, COLORS.navy], ["Rel", d.released, "#1565C0"], ["Used", d.utilized, "#2E7D32"]] as [string, number, string][]).map(([lbl, val, col]) => (
              <View key={lbl} className="flex-row items-center gap-2 mb-0.5">
                <Text className="text-xs w-7" style={{ color: COLORS.muted }}>{lbl}</Text>
                <View className="flex-1 h-2.5 bg-muted rounded-sm overflow-hidden">
                  <View style={{ width: `${d.alloc > 0 ? Math.min(100, (val / d.alloc) * 100) : 0}%`, height: 10, backgroundColor: col }} />
                </View>
                <Text className="text-xs w-14 text-right" style={{ color: COLORS.muted }}>{formatINR(val)}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
