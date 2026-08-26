import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react-native";
import { COLORS, DEMO_BADGE, FINANCIAL_YEARS, STATES_DISTRICTS, formatINR, formatBeneficiaries } from "@/lib/constants";
import { fetchDistrictData } from "@/db/api";

type DrillLevel = "national" | "state" | "district";

type StateSummary = {
  state: string;
  alloc: number;
  released: number;
  utilized: number;
  beneficiaries: number;
  projects: number;
  physical: number;
  delayed: number;
};

type DistrictSummary = StateSummary & { district: string };

export default function TransparencyScreen() {
  const [level, setLevel]               = useState<DrillLevel>("national");
  const [selectedState, setSelectedState] = useState("");
  const [selectedFY, setSelectedFY]     = useState("2024-25");
  const [stateSummaries, setStateSummaries] = useState<StateSummary[]>([]);
  const [districtData, setDistrictData]   = useState<DistrictSummary[]>([]);
  const [loading, setLoading]           = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadNational();
    }, [selectedFY])
  );

  async function loadNational() {
    setLoading(true);
    const states = Object.keys(STATES_DISTRICTS);
    const results: StateSummary[] = [];
    for (const state of states) {
      const rows = await fetchDistrictData(state, undefined, undefined, selectedFY);
      if (rows.length) {
        results.push({
          state,
          alloc:         rows.reduce((s, r) => s + (r.allocated_cr as number), 0),
          released:      rows.reduce((s, r) => s + (r.released_cr  as number), 0),
          utilized:      rows.reduce((s, r) => s + (r.utilized_cr  as number), 0),
          beneficiaries: rows.reduce((s, r) => s + (r.beneficiaries as number), 0),
          projects:      rows.length,
          physical:      rows.reduce((s, r) => s + (r.physical_progress_pct as number), 0) / rows.length,
          delayed:       rows.filter((r) => (r.utilized_cr as number) / Math.max(r.allocated_cr as number, 1) < 0.3).length,
        });
      }
    }
    setStateSummaries(results);
    setLoading(false);
  }

  async function drillToState(state: string) {
    setLoading(true);
    setSelectedState(state);
    const districts = STATES_DISTRICTS[state] ?? [];
    const dRows: DistrictSummary[] = [];
    for (const district of districts) {
      const rows = await fetchDistrictData(state, district, undefined, selectedFY);
      if (rows.length) {
        dRows.push({
          state, district,
          alloc:         rows.reduce((s, r) => s + (r.allocated_cr as number), 0),
          released:      rows.reduce((s, r) => s + (r.released_cr  as number), 0),
          utilized:      rows.reduce((s, r) => s + (r.utilized_cr  as number), 0),
          beneficiaries: rows.reduce((s, r) => s + (r.beneficiaries as number), 0),
          projects:      rows.length,
          physical:      rows.length > 0 ? rows.reduce((s, r) => s + (r.physical_progress_pct as number), 0) / rows.length : 0,
          delayed:       rows.filter((r) => (r.utilized_cr as number) / Math.max(r.allocated_cr as number, 1) < 0.3).length,
        });
      }
    }
    setDistrictData(dRows);
    setLevel("district");
    setLoading(false);
  }

  const nationalTotals = {
    alloc:         stateSummaries.reduce((s, r) => s + r.alloc, 0),
    released:      stateSummaries.reduce((s, r) => s + r.released, 0),
    utilized:      stateSummaries.reduce((s, r) => s + r.utilized, 0),
    beneficiaries: stateSummaries.reduce((s, r) => s + r.beneficiaries, 0),
    projects:      stateSummaries.reduce((s, r) => s + r.projects, 0),
    delayed:       stateSummaries.reduce((s, r) => s + r.delayed, 0),
  };
  const nationalUtil = nationalTotals.alloc > 0 ? (nationalTotals.utilized / nationalTotals.alloc) * 100 : 0;

  const activeList = level === "national" ? stateSummaries : districtData;
  const sorted = [...activeList].sort((a, b) => {
    const aUtil = a.alloc > 0 ? a.utilized / a.alloc : 0;
    const bUtil = b.alloc > 0 ? b.utilized / b.alloc : 0;
    return bUtil - aUtil;
  });
  const top3 = sorted.slice(0, 3);
  const bottom3 = [...sorted].reverse().slice(0, 3);

  function getLabel(item: StateSummary | DistrictSummary) {
    return "district" in item ? item.district : item.state;
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-5 pt-14 pb-5" style={{ backgroundColor: COLORS.navy }}>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-xl font-bold text-white">Public Transparency</Text>
          <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${COLORS.primary}30` }}>
            <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>{DEMO_BADGE}</Text>
          </View>
        </View>
        <Text className="text-xs text-white/70 mb-4">Government fund utilization — openly available data</Text>

        {/* FY filter */}
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-white/60">FY:</Text>
          {FINANCIAL_YEARS.map((fy) => (
            <Pressable key={fy} onPress={() => { setSelectedFY(fy); setLevel("national"); loadNational(); }} className="px-3 py-1 rounded-sm border"
              style={{ backgroundColor: selectedFY === fy ? COLORS.primary : "transparent", borderColor: selectedFY === fy ? COLORS.primary : "rgba(255,255,255,0.3)" }}>
              <Text className="text-xs font-semibold" style={{ color: selectedFY === fy ? "#fff" : "rgba(255,255,255,0.7)" }}>{fy}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Breadcrumb */}
      <View className="px-4 py-2 bg-card border-b border-border flex-row items-center gap-1">
        <Pressable onPress={() => { setLevel("national"); }}>
          <Text className="text-sm font-semibold" style={{ color: level === "national" ? COLORS.primary : COLORS.navy }}>National</Text>
        </Pressable>
        {level !== "national" && (
          <>
            <Text className="text-muted-foreground text-sm"> › </Text>
            <Text className="text-sm font-semibold" style={{ color: COLORS.primary }}>{selectedState}</Text>
          </>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text className="text-muted-foreground text-sm mt-2">Loading transparency data...</Text>
        </View>
      ) : (
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          {/* National Overview */}
          {level === "national" && (
            <View className="mx-4 mt-4 mb-2">
              <Text className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">National Overview — FY {selectedFY}</Text>
              <View className="flex-row flex-wrap gap-3 mb-3">
                {[
                  { l: "Total Schemes",     v: String(nationalTotals.projects),             c: COLORS.navy },
                  { l: "Funds Allocated",   v: formatINR(nationalTotals.alloc),             c: COLORS.navy },
                  { l: "Funds Released",    v: formatINR(nationalTotals.released),           c: "#1565C0" },
                  { l: "Funds Utilized",    v: formatINR(nationalTotals.utilized),           c: "#2E7D32" },
                  { l: "Utilization %",     v: `${nationalUtil.toFixed(1)}%`,               c: nationalUtil < 50 ? COLORS.brickRed : "#2E7D32" },
                  { l: "Total Beneficiaries", v: formatBeneficiaries(nationalTotals.beneficiaries), c: "#6A1B9A" },
                  { l: "Delayed Projects",  v: String(nationalTotals.delayed),              c: COLORS.warning },
                ].map((k) => (
                  <View key={k.l} className="bg-card border border-border rounded-sm p-3" style={{ width: "47%" }}>
                    <Text className="text-xs text-muted-foreground mb-0.5">{k.l}</Text>
                    <Text className="text-lg font-bold" style={{ color: k.c }}>{k.v}</Text>
                  </View>
                ))}
              </View>
              <Text className="text-xs text-center text-muted-foreground italic mb-3">
                ⚠️ Demo Mode — Synthetic Data. Verify figures with official government sources.
              </Text>
            </View>
          )}

          {/* Top Performers */}
          <View className="mx-4 mb-3">
            <View className="flex-row items-center gap-2 mb-2">
              <TrendingUp size={16} color="#2E7D32" />
              <Text className="text-sm font-bold text-foreground">
                Top Performing {level === "national" ? "States" : "Districts"}
              </Text>
            </View>
            {top3.map((item, i) => {
              const pct = item.alloc > 0 ? (item.utilized / item.alloc) * 100 : 0;
              return (
                <Pressable
                  key={getLabel(item)}
                  className="bg-card border border-border rounded-sm p-3 mb-2 flex-row items-center gap-3 active:opacity-80"
                  style={{ borderLeftWidth: 3, borderLeftColor: "#2E7D32" }}
                  onPress={() => level === "national" ? drillToState(item.state) : undefined}
                >
                  <View className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: "#e8f5e9" }}>
                    <Text className="text-sm font-bold" style={{ color: "#2E7D32" }}>#{i + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{getLabel(item)}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {item.projects} schemes · {formatBeneficiaries(item.beneficiaries)} beneficiaries
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-base font-bold" style={{ color: "#2E7D32" }}>{pct.toFixed(0)}%</Text>
                    <Text className="text-xs text-muted-foreground">utilized</Text>
                  </View>
                  {level === "national" && <ChevronRight size={14} color={COLORS.muted} />}
                </Pressable>
              );
            })}
          </View>

          {/* Bottom Performers */}
          <View className="mx-4 mb-3">
            <View className="flex-row items-center gap-2 mb-2">
              <TrendingDown size={16} color={COLORS.brickRed} />
              <Text className="text-sm font-bold text-foreground">
                Needs Attention — {level === "national" ? "States" : "Districts"}
              </Text>
            </View>
            {bottom3.map((item, i) => {
              const pct = item.alloc > 0 ? (item.utilized / item.alloc) * 100 : 0;
              return (
                <View
                  key={getLabel(item)}
                  className="bg-card border border-border rounded-sm p-3 mb-2 flex-row items-center gap-3"
                  style={{ borderLeftWidth: 3, borderLeftColor: COLORS.brickRed }}
                >
                  <View className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: `${COLORS.brickRed}15` }}>
                    <Text className="text-sm font-bold" style={{ color: COLORS.brickRed }}>!{i + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{getLabel(item)}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {item.delayed} delayed · {item.projects} total schemes
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-base font-bold" style={{ color: COLORS.brickRed }}>{pct.toFixed(0)}%</Text>
                    <Text className="text-xs text-muted-foreground">utilized</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* State list / District list */}
          <View className="mx-4 mb-8">
            <Text className="text-sm font-bold text-foreground mb-2">
              All {level === "national" ? "States" : `Districts in ${selectedState}`}
            </Text>
            {activeList.map((item) => {
              const pct = item.alloc > 0 ? (item.utilized / item.alloc) * 100 : 0;
              return (
                <Pressable
                  key={getLabel(item)}
                  className="bg-card border border-border rounded-sm p-4 mb-2 active:opacity-80"
                  onPress={() => level === "national" ? drillToState(item.state) : undefined}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-foreground">{getLabel(item)}</Text>
                      <View className="flex-row gap-3 mt-1 flex-wrap">
                        <Text className="text-xs text-muted-foreground">Alloc: {formatINR(item.alloc)}</Text>
                        <Text className="text-xs text-muted-foreground">Released: {formatINR(item.released)}</Text>
                        <Text className="text-xs text-muted-foreground">Used: {formatINR(item.utilized)}</Text>
                        <Text className="text-xs text-muted-foreground">Benef: {formatBeneficiaries(item.beneficiaries)}</Text>
                        <Text className="text-xs text-muted-foreground">Delayed: {item.delayed}</Text>
                      </View>
                      <View className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                        <View className="h-1.5 rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: pct < 40 ? COLORS.brickRed : pct < 70 ? COLORS.warning : "#2E7D32" }} />
                      </View>
                    </View>
                    <View className="ml-3 items-end">
                      <Text className="text-lg font-bold" style={{ color: pct < 40 ? COLORS.brickRed : pct < 70 ? COLORS.warning : "#2E7D32" }}>
                        {pct.toFixed(0)}%
                      </Text>
                      {level === "national" && <ChevronRight size={14} color={COLORS.muted} />}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
