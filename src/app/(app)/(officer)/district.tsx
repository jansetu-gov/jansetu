import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft, ChevronRight, ArrowDown } from "lucide-react-native";

import { COLORS, DEMO_BADGE, FINANCIAL_YEARS, STATES_DISTRICTS, formatINR, formatBeneficiaries } from "@/lib/constants";
import { fetchDistrictData } from "@/db/api";
import { detectAnomalies } from "@/lib/anomalies";

type Level = "state" | "district" | "scheme";

export default function DistrictDrillDown() {
  const router = useRouter();

  const [selectedState, setSelectedState]       = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedScheme, setSelectedScheme]     = useState<Record<string, unknown> | null>(null);
  const [level, setLevel]                       = useState<Level>("state");
  const [selectedFY, setSelectedFY]             = useState("2024-25");
  const [data, setData]                         = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]                   = useState(false);

  // Load district data when district selected
  const loadDistrictSchemes = useCallback(async (state: string, district: string) => {
    setLoading(true);
    const rows = await fetchDistrictData(state, district, undefined, selectedFY);
    setData(rows);
    setLoading(false);
  }, [selectedFY]);

  function selectState(st: string) {
    setSelectedState(st);
    setSelectedDistrict("");
    setSelectedScheme(null);
    setLevel("district");
  }

  function selectDistrict(d: string) {
    setSelectedDistrict(d);
    setSelectedScheme(null);
    setLevel("scheme");
    loadDistrictSchemes(selectedState, d);
  }

  function selectScheme(row: Record<string, unknown>) {
    setSelectedScheme(row);
  }

  function breadcrumb(back: Level) {
    setLevel(back);
    if (back === "state") { setSelectedState(""); setSelectedDistrict(""); setSelectedScheme(null); setData([]); }
    if (back === "district") { setSelectedDistrict(""); setSelectedScheme(null); }
  }

  const anomalies = data.length ? detectAnomalies(data) : [];

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 bg-card border-b border-border flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={8}><ArrowLeft size={22} color={COLORS.navy} /></Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">District Drill-Down</Text>
          <Text className="text-xs text-muted-foreground">India → State → District → Scheme</Text>
        </View>
        <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${COLORS.primary}15` }}>
          <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>{DEMO_BADGE}</Text>
        </View>
      </View>

      {/* Breadcrumb */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-2 border-b border-border bg-card">
        <View className="flex-row items-center gap-1">
          {[
            { label: "India", back: "state" as Level },
            ...(selectedState ? [{ label: selectedState, back: "district" as Level }] : []),
            ...(selectedDistrict ? [{ label: selectedDistrict, back: "scheme" as Level }] : []),
            ...(selectedScheme ? [{ label: (selectedScheme.scheme_name as string).slice(0, 18), back: "scheme" as Level }] : []),
          ].map((crumb, i, arr) => (
            <View key={crumb.label} className="flex-row items-center gap-1">
              <Pressable onPress={() => breadcrumb(crumb.back)}>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: i === arr.length - 1 ? COLORS.primary : COLORS.navy }}
                >
                  {crumb.label}
                </Text>
              </Pressable>
              {i < arr.length - 1 && <Text className="text-muted-foreground text-sm"> › </Text>}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* FY Filter */}
      <View className="px-4 py-2 border-b border-border flex-row items-center gap-2">
        <Text className="text-xs text-muted-foreground">FY:</Text>
        {FINANCIAL_YEARS.map((fy) => (
          <Pressable key={fy} onPress={() => setSelectedFY(fy)} className="px-3 py-1 rounded-sm border"
            style={{ backgroundColor: selectedFY === fy ? COLORS.primary : "#fff", borderColor: selectedFY === fy ? COLORS.primary : COLORS.border }}>
            <Text className="text-xs font-semibold" style={{ color: selectedFY === fy ? "#fff" : COLORS.navy }}>{fy}</Text>
          </Pressable>
        ))}
      </View>

      {/* Level: Select State */}
      {level === "state" && (
        <FlatList
          data={Object.keys(STATES_DISTRICTS)}
          keyExtractor={(item) => item}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={<Text className="text-sm font-bold text-foreground mb-2">Select State</Text>}
          renderItem={({ item }) => (
            <Pressable
              className="bg-card border border-border rounded-sm px-4 py-4 flex-row items-center justify-between active:opacity-80"
              onPress={() => selectState(item)}
            >
              <Text className="text-base font-semibold text-foreground">{item}</Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-muted-foreground">{STATES_DISTRICTS[item].length} districts</Text>
                <ChevronRight size={16} color={COLORS.muted} />
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Level: Select District */}
      {level === "district" && (
        <FlatList
          data={STATES_DISTRICTS[selectedState] ?? []}
          keyExtractor={(item) => item}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={<Text className="text-sm font-bold text-foreground mb-2">Select District — {selectedState}</Text>}
          renderItem={({ item }) => (
            <Pressable
              className="bg-card border border-border rounded-sm px-4 py-4 flex-row items-center justify-between active:opacity-80"
              onPress={() => selectDistrict(item)}
            >
              <Text className="text-base font-semibold text-foreground">{item}</Text>
              <View className="flex-row items-center gap-1">
                {item === "Kamrup" && selectedState === "Assam" && (
                  <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${COLORS.brickRed}15` }}>
                    <Text className="text-xs font-bold" style={{ color: COLORS.brickRed }}>⚠️ Flagged</Text>
                  </View>
                )}
                <ChevronRight size={16} color={COLORS.muted} />
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Level: Scheme list */}
      {level === "scheme" && !selectedScheme && (
        loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <ScrollView contentInsetAdjustmentBehavior="automatic">
            {/* District Summary */}
            {data.length > 0 && <DistrictSummary data={data} anomalyCount={anomalies.length} />}
            <View className="px-4 pb-6">
              <Text className="text-sm font-bold text-foreground mb-3">
                Schemes in {selectedDistrict}
              </Text>
              {data.map((row) => {
                const pct = (row.allocated_cr as number) > 0
                  ? ((row.utilized_cr as number) / (row.allocated_cr as number)) * 100 : 0;
                const isLow = pct < 60;
                const isHackathon = row.district === "Kamrup" && (row.scheme_name as string).includes("Agriculture");
                return (
                  <Pressable
                    key={row.id as string}
                    className="bg-card border border-border rounded-sm p-4 mb-3 active:opacity-80"
                    style={{ borderLeftWidth: 3, borderLeftColor: isHackathon ? COLORS.brickRed : isLow ? COLORS.warning : "#2E7D32" }}
                    onPress={() => selectScheme(row)}
                  >
                    {isHackathon && (
                      <View className="mb-2 self-start px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${COLORS.brickRed}15` }}>
                        <Text className="text-xs font-bold" style={{ color: COLORS.brickRed }}>⚠️ HIGH PRIORITY REVIEW</Text>
                      </View>
                    )}
                    <View className="flex-row items-start justify-between">
                      <Text className="flex-1 text-sm font-bold text-foreground pr-2">{row.scheme_name as string}</Text>
                      <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: isLow ? `${COLORS.brickRed}15` : "#e8f5e9" }}>
                        <Text className="text-xs font-bold" style={{ color: isLow ? COLORS.brickRed : "#2E7D32" }}>
                          {pct.toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row gap-3 mt-1.5 flex-wrap">
                      <Text className="text-xs text-muted-foreground">Alloc: {formatINR(row.allocated_cr as number)}</Text>
                      <Text className="text-xs text-muted-foreground">Released: {formatINR(row.released_cr as number)}</Text>
                      <Text className="text-xs text-muted-foreground">Used: {formatINR(row.utilized_cr as number)}</Text>
                    </View>
                    <View className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <View className="h-1.5 rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: isLow ? COLORS.brickRed : "#2E7D32" }} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )
      )}

      {/* Level: Scheme detail */}
      {level === "scheme" && !!selectedScheme && (
        <SchemeDetailDrill row={selectedScheme} onBack={() => setSelectedScheme(null)} />
      )}
    </View>
  );
}

function DistrictSummary({ data, anomalyCount }: { data: Record<string, unknown>[]; anomalyCount: number }) {
  const totAlloc   = data.reduce((s, d) => s + (d.allocated_cr as number), 0);
  const totReleased= data.reduce((s, d) => s + (d.released_cr  as number), 0);
  const totUtil    = data.reduce((s, d) => s + (d.utilized_cr  as number), 0);
  const utilPct    = totAlloc > 0 ? (totUtil / totAlloc) * 100 : 0;
  const totBenef   = data.reduce((s, d) => s + (d.beneficiaries as number), 0);
  const delayed    = data.filter((d) => (d.utilized_cr as number) / Math.max(d.allocated_cr as number, 1) < 0.3).length;

  return (
    <View className="mx-4 mt-4 mb-2 bg-card border border-border rounded-sm p-4">
      <Text className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">District Summary</Text>
      <View className="flex-row flex-wrap gap-3">
        {[
          { label: "Allocated", value: formatINR(totAlloc), color: COLORS.navy },
          { label: "Released",  value: formatINR(totReleased), color: "#1565C0" },
          { label: "Utilized",  value: formatINR(totUtil), color: "#2E7D32" },
          { label: "Utilization", value: `${utilPct.toFixed(1)}%`, color: utilPct < 60 ? COLORS.brickRed : "#2E7D32" },
          { label: "Beneficiaries", value: formatBeneficiaries(totBenef), color: "#6A1B9A" },
          { label: "Delayed Schemes", value: String(delayed), color: COLORS.warning },
          { label: "Anomalies", value: String(anomalyCount), color: COLORS.brickRed },
        ].map((kpi) => (
          <View key={kpi.label} className="w-[47%]">
            <Text className="text-xs text-muted-foreground">{kpi.label}</Text>
            <Text className="text-base font-bold" style={{ color: kpi.color }}>{kpi.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SchemeDetailDrill({ row, onBack }: { row: Record<string, unknown>; onBack: () => void }) {
  const allocated  = row.allocated_cr as number;
  const released   = row.released_cr  as number;
  const utilized   = row.utilized_cr  as number;
  const physical   = row.physical_progress_pct as number;
  const financial  = allocated > 0 ? (utilized / allocated) * 100 : 0;
  const remaining  = allocated - utilized;
  const monthly    = (row.monthly_data as { month: string; utilized: number }[]) ?? [];
  const anomalies  = detectAnomalies([row]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <View className="px-4 pt-4 pb-2 flex-row items-center gap-2">
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={{ color: COLORS.primary }}>← Back to Schemes</Text>
        </Pressable>
      </View>

      {/* Hackathon scenario banner */}
      {row.district === "Kamrup" && (row.scheme_name as string).includes("Agriculture") && (
        <View className="mx-4 mb-3 p-4 rounded-sm" style={{ backgroundColor: `${COLORS.brickRed}10`, borderWidth: 1, borderColor: `${COLORS.brickRed}40` }}>
          <Text className="text-base font-bold mb-1" style={{ color: COLORS.brickRed }}>⚠️ HIGH PRIORITY REVIEW</Text>
          <Text className="text-sm" style={{ color: COLORS.brickRed }}>
            Fund utilization is significantly below the expected level.
          </Text>
        </View>
      )}

      {/* KPIs */}
      <View className="mx-4 mb-3 bg-card border border-border rounded-sm p-4">
        <Text className="text-base font-bold text-foreground mb-3">{row.scheme_name as string}</Text>
        <View className="flex-row flex-wrap gap-3">
          {[
            { l: "Allocated",    v: formatINR(allocated),  c: COLORS.navy },
            { l: "Released",     v: formatINR(released),   c: "#1565C0" },
            { l: "Utilized",     v: formatINR(utilized),   c: "#2E7D32" },
            { l: "Remaining",    v: formatINR(remaining),  c: COLORS.warning },
            { l: "Financial %",  v: `${financial.toFixed(1)}%`, c: financial < 40 ? COLORS.brickRed : "#2E7D32" },
            { l: "Physical %",   v: `${physical}%`,        c: physical < 40 ? COLORS.brickRed : "#2E7D32" },
            { l: "Beneficiaries",v: formatBeneficiaries(row.beneficiaries as number), c: "#6A1B9A" },
          ].map((k) => (
            <View key={k.l} className="w-[47%]">
              <Text className="text-xs text-muted-foreground">{k.l}</Text>
              <Text className="text-lg font-bold" style={{ color: k.c }}>{k.v}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Monthly Chart */}
      {monthly.length > 0 && (
        <View className="mx-4 mb-3 bg-card border border-border rounded-sm p-4">
          <Text className="text-sm font-bold text-foreground mb-2">Monthly Utilization Trend</Text>
          <NativeBarChart data={monthly.map((m) => ({ x: m.month.slice(0, 3), y: m.utilized }))} color={COLORS.primary} height={160} />
        </View>
      )}

      {/* Financial vs Physical */}
      <View className="mx-4 mb-3 bg-card border border-border rounded-sm p-4">
        <Text className="text-sm font-bold text-foreground mb-3">Financial vs Physical Progress</Text>
        <View className="gap-3">
          <ProgressBar label="Financial Progress" pct={financial} color={financial < 40 ? COLORS.brickRed : "#2E7D32"} />
          <ProgressBar label="Physical Progress" pct={physical} color={physical < 40 ? COLORS.brickRed : "#1565C0"} />
        </View>
        {Math.abs(financial - physical) > 25 && (
          <View className="mt-3 p-2 rounded-sm" style={{ backgroundColor: `${COLORS.brickRed}10` }}>
            <Text className="text-xs" style={{ color: COLORS.brickRed }}>
              ⚠️ Gap of {Math.abs(financial - physical).toFixed(0)}% between financial and physical progress — requires administrative review.
            </Text>
          </View>
        )}
      </View>

      {/* Anomalies for this scheme */}
      {anomalies.length > 0 && (
        <View className="mx-4 mb-6">
          <Text className="text-sm font-bold text-foreground mb-2">Anomaly Flags</Text>
          {anomalies.map((a) => (
            <View key={a.id} className="bg-card border border-border rounded-sm p-4 mb-2"
              style={{ borderLeftWidth: 3, borderLeftColor: a.severity === "HIGH" ? COLORS.brickRed : COLORS.warning }}>
              <View className="flex-row items-center gap-2 mb-1">
                <SeverityBadge severity={a.severity} />
                <Text className="text-sm font-semibold text-foreground flex-1">{a.reason}</Text>
              </View>
              <Text className="text-xs text-muted-foreground mb-2">{a.detail}</Text>
              <Text className="text-xs font-semibold text-foreground">📋 Recommended Action:</Text>
              <Text className="text-xs text-muted-foreground">{a.recommended_action}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

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

function ProgressBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View>
      <View className="flex-row justify-between mb-1">
        <Text className="text-xs text-foreground">{label}</Text>
        <Text className="text-xs font-bold" style={{ color }}>{pct.toFixed(1)}%</Text>
      </View>
      <View className="h-3 bg-muted rounded-full overflow-hidden">
        <View className="h-3 rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = severity === "HIGH"
    ? { bg: `${COLORS.brickRed}15`, color: COLORS.brickRed }
    : severity === "MEDIUM"
    ? { bg: `${COLORS.warning}15`, color: COLORS.warning }
    : { bg: "#e8f5e9", color: "#2E7D32" };
  return (
    <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: cfg.bg }}>
      <Text className="text-xs font-bold" style={{ color: cfg.color }}>{severity}</Text>
    </View>
  );
}
