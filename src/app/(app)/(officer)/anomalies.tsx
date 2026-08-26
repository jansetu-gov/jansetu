import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react-native";

import { COLORS, DEMO_BADGE, FINANCIAL_YEARS, STATES_DISTRICTS, formatINR, formatBeneficiaries } from "@/lib/constants";
import { fetchDistrictData } from "@/db/api";
import { detectAnomalies, type Anomaly } from "@/lib/anomalies";

export default function AnomaliesScreen() {
  const router = useRouter();

  const [selectedState, setSelectedState]       = useState("Assam");
  const [selectedDistrict, setSelectedDistrict] = useState("Kamrup");
  const [selectedFY, setSelectedFY]             = useState("2024-25");
  const [anomalies, setAnomalies]               = useState<Anomaly[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [expandedId, setExpandedId]             = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchDistrictData(selectedState, selectedDistrict, undefined, selectedFY)
        .then((rows) => setAnomalies(detectAnomalies(rows)))
        .finally(() => setLoading(false));
    }, [selectedState, selectedDistrict, selectedFY])
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 bg-card border-b border-border flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={8}><ArrowLeft size={22} color={COLORS.navy} /></Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">Anomaly Detection</Text>
          <Text className="text-xs text-muted-foreground">Rules-based · No AI inference</Text>
        </View>
        <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${COLORS.primary}15` }}>
          <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>{DEMO_BADGE}</Text>
        </View>
      </View>

      {/* Filters */}
      <View className="px-4 py-3 bg-card border-b border-border gap-2">
        <FilterRow label="State"    options={Object.keys(STATES_DISTRICTS)} selected={selectedState}    onSelect={(v) => { setSelectedState(v); setSelectedDistrict(STATES_DISTRICTS[v][0]); }} />
        <FilterRow label="District" options={STATES_DISTRICTS[selectedState] ?? []} selected={selectedDistrict} onSelect={setSelectedDistrict} />
        <FilterRow label="FY"       options={FINANCIAL_YEARS} selected={selectedFY} onSelect={setSelectedFY} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={anomalies}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={
            <View className="mb-2">
              {anomalies.length === 0 ? null : (
                <View className="p-3 rounded-sm mb-3" style={{ backgroundColor: `${COLORS.brickRed}08`, borderWidth: 1, borderColor: `${COLORS.brickRed}20` }}>
                  <Text className="text-sm font-bold" style={{ color: COLORS.brickRed }}>
                    {anomalies.filter((a) => a.severity === "HIGH").length} High · {anomalies.filter((a) => a.severity === "MEDIUM").length} Medium anomalies detected
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    Based on {selectedDistrict}, {selectedState} — {selectedFY}
                  </Text>
                </View>
              )}
              {/* Detection Rules Legend */}
              <View className="bg-card border border-border rounded-sm p-3 mb-2">
                <Text className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Detection Rules Applied</Text>
                {[
                  "Utilization <30% when FY >50% complete → HIGH",
                  "Released-Utilized gap >40% → MEDIUM",
                  "Financial vs Physical divergence >25% → HIGH",
                  "District >2σ below average utilization → HIGH",
                ].map((rule, i) => (
                  <Text key={i} className="text-xs text-muted-foreground mb-1">• {rule}</Text>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="py-16 items-center gap-3">
              <Text className="text-4xl">✅</Text>
              <Text className="text-base font-semibold text-foreground">No anomalies detected</Text>
              <Text className="text-sm text-muted-foreground text-center px-4">
                All schemes in {selectedDistrict} meet utilization thresholds for {selectedFY}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <AnomalyCard
              anomaly={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

function AnomalyCard({ anomaly, expanded, onToggle }: { anomaly: Anomaly; expanded: boolean; onToggle: () => void }) {
  const severityCfg = {
    HIGH:   { bg: `${COLORS.brickRed}15`,  color: COLORS.brickRed, border: `${COLORS.brickRed}50`  },
    MEDIUM: { bg: `${COLORS.warning}15`,   color: COLORS.warning,   border: `${COLORS.warning}50`   },
    LOW:    { bg: "#e8f5e9",               color: "#2E7D32",        border: "#a5d6a7"                },
  }[anomaly.severity];

  return (
    <View className="bg-card border border-border rounded-sm overflow-hidden"
      style={{ borderLeftWidth: 4, borderLeftColor: severityCfg.color }}>
      <Pressable onPress={onToggle} className="p-4" android_ripple={{ color: "rgba(0,0,0,0.04)" }}>
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: severityCfg.bg }}>
                <Text className="text-xs font-bold" style={{ color: severityCfg.color }}>{anomaly.severity}</Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                {new Date(anomaly.detected_at).toLocaleDateString("en-IN")}
              </Text>
            </View>
            <Text className="text-sm font-bold text-foreground">{anomaly.scheme_name}</Text>
            <Text className="text-xs text-muted-foreground">{anomaly.district}, {anomaly.state}</Text>
            <Text className="text-sm text-muted-foreground mt-1 font-medium">{anomaly.reason}</Text>
          </View>
          {expanded ? <ChevronUp size={18} color={COLORS.muted} /> : <ChevronDown size={18} color={COLORS.muted} />}
        </View>
        <View className="flex-row gap-3 mt-2 flex-wrap">
          <Text className="text-xs text-muted-foreground">Alloc: {formatINR(anomaly.allocated_cr)}</Text>
          <Text className="text-xs text-muted-foreground">Released: {formatINR(anomaly.released_cr)}</Text>
          <Text className="text-xs" style={{ color: anomaly.utilized_cr / anomaly.allocated_cr < 0.4 ? COLORS.brickRed : "#2E7D32" }}>
            Used: {formatINR(anomaly.utilized_cr)} ({anomaly.allocated_cr > 0 ? ((anomaly.utilized_cr / anomaly.allocated_cr) * 100).toFixed(0) : 0}%)
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 border-t border-border pt-3">
          <Text className="text-sm text-foreground mb-3">{anomaly.detail}</Text>

          {/* Mini chart: financial vs physical */}
          <View className="mb-3">
            <Text className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Progress Overview</Text>
            <View className="gap-2">
              {[
                { label: "Financial Progress", pct: anomaly.allocated_cr > 0 ? (anomaly.utilized_cr / anomaly.allocated_cr) * 100 : 0, color: COLORS.primary },
                { label: "Physical Progress",  pct: anomaly.physical_progress_pct, color: "#2E7D32" },
              ].map((bar) => (
                <View key={bar.label}>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-xs text-foreground">{bar.label}</Text>
                    <Text className="text-xs font-bold" style={{ color: bar.color }}>{bar.pct.toFixed(1)}%</Text>
                  </View>
                  <View className="h-2 bg-muted rounded-full overflow-hidden">
                    <View className="h-2 rounded-full" style={{ width: `${Math.min(100, bar.pct)}%`, backgroundColor: bar.color }} />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="p-3 rounded-sm" style={{ backgroundColor: `${COLORS.navy}08`, borderWidth: 1, borderColor: `${COLORS.navy}15` }}>
            <Text className="text-xs font-bold text-foreground mb-1">📋 Recommended Administrative Action</Text>
            <Text className="text-xs text-muted-foreground">{anomaly.recommended_action}</Text>
          </View>
        </View>
      )}
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
