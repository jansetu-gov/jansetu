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
import {
  BarChart3,
  MapPin,
  AlertTriangle,
  ListChecks,
  LogOut,
  ChevronRight,
  TrendingUp,
} from "lucide-react-native";
import { supabase } from "@/client/supabase";
import { useSession } from "@/ctx";
import { COLORS, DEMO_BADGE, FINANCIAL_YEARS, STATES_DISTRICTS, formatINR, formatBeneficiaries } from "@/lib/constants";
import { fetchDistrictData, fetchProfile } from "@/db/api";
import { detectAnomalies } from "@/lib/anomalies";

const KPI_COLOR_MAP: Record<string, string> = {
  "Total Schemes": COLORS.navy,
  "Allocated": COLORS.navy,
  "Released": "#1565C0",
  "Utilized": "#2E7D32",
  "Utilization %": COLORS.primary,
  "Delayed": COLORS.warning,
  "Anomalies": COLORS.brickRed,
  "Beneficiaries": "#6A1B9A",
};

type NavItem = { label: string; icon: React.ReactNode; route: string };

export default function OfficerOverview() {
  const router = useRouter();
  const { session } = useSession();

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [districtData, setDistrictData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState("Assam");
  const [selectedDistrict, setSelectedDistrict] = useState("Kamrup");
  const [selectedFY, setSelectedFY] = useState("2024-25");
  const [anomalyCount, setAnomalyCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user.id) return;
      setLoading(true);
      Promise.all([
        fetchProfile(session.user.id),
        fetchDistrictData(selectedState, selectedDistrict, undefined, selectedFY),
      ]).then(([p, data]) => {
        setProfile(p);
        setDistrictData(data);
        setAnomalyCount(detectAnomalies(data).length);
      }).finally(() => setLoading(false));
    }, [session?.user.id, selectedState, selectedDistrict, selectedFY])
  );

  const totalAllocated = districtData.reduce((s, d) => s + (d.allocated_cr as number), 0);
  const totalReleased  = districtData.reduce((s, d) => s + (d.released_cr  as number), 0);
  const totalUtilized  = districtData.reduce((s, d) => s + (d.utilized_cr  as number), 0);
  const utilPct        = totalAllocated > 0 ? (totalUtilized / totalAllocated) * 100 : 0;
  const totalBenef     = districtData.reduce((s, d) => s + (d.beneficiaries as number), 0);
  const delayed        = districtData.filter((d) => (d.utilized_cr as number) / Math.max(d.allocated_cr as number, 1) < 0.3).length;

  const kpis = [
    { label: "Total Schemes", value: String(districtData.length), sub: "in district" },
    { label: "Allocated",     value: formatINR(totalAllocated),   sub: "FY " + selectedFY },
    { label: "Released",      value: formatINR(totalReleased),    sub: "to district" },
    { label: "Utilized",      value: formatINR(totalUtilized),    sub: "actual spend" },
    { label: "Utilization %", value: `${utilPct.toFixed(1)}%`,   sub: utilPct < 60 ? "⚠️ Below target" : "✅ On track" },
    { label: "Delayed",       value: String(delayed),             sub: "schemes <30%" },
    { label: "Anomalies",     value: String(anomalyCount),        sub: "flagged" },
    { label: "Beneficiaries", value: formatBeneficiaries(totalBenef), sub: "total" },
  ];

  const navItems: NavItem[] = [
    { label: "Charts & Analytics", icon: <BarChart3 size={22} color={COLORS.navy} />, route: "/(app)/(officer)/charts" },
    { label: "District Drill-Down", icon: <MapPin size={22} color={COLORS.navy} />, route: "/(app)/(officer)/district" },
    { label: "Anomaly Detection", icon: <AlertTriangle size={22} color={COLORS.brickRed} />, route: "/(app)/(officer)/anomalies" },
    { label: "Scheme Management", icon: <ListChecks size={22} color={COLORS.navy} />, route: "/(app)/(officer)/schemes" },
  ];

  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      {/* Header */}
      <View className="px-5 pt-14 pb-5" style={{ backgroundColor: COLORS.navy }}>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-2xl font-bold text-white">GrantTrack Gov</Text>
          <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${COLORS.primary}30` }}>
            <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>{DEMO_BADGE}</Text>
          </View>
        </View>
        <Text className="text-sm text-white/70 mb-4">
          {profile ? `Officer: ${profile.display_name ?? profile.username}` : "District Dashboard"}
        </Text>

        {/* State / District / FY Filters */}
        <View className="gap-2">
          <FilterRow
            label="State"
            options={Object.keys(STATES_DISTRICTS)}
            selected={selectedState}
            onSelect={(v) => { setSelectedState(v); setSelectedDistrict(STATES_DISTRICTS[v][0]); }}
          />
          <FilterRow
            label="District"
            options={STATES_DISTRICTS[selectedState] ?? []}
            selected={selectedDistrict}
            onSelect={setSelectedDistrict}
          />
          <FilterRow
            label="FY"
            options={FINANCIAL_YEARS}
            selected={selectedFY}
            onSelect={setSelectedFY}
          />
        </View>
      </View>

      {loading ? (
        <View className="py-12 items-center">
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text className="text-muted-foreground text-sm mt-2">Loading district data...</Text>
        </View>
      ) : (
        <>
          {/* KPI Grid */}
          <View className="px-4 pt-4">
            <Text className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">
              District KPIs — {selectedDistrict}, {selectedState}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {kpis.map((kpi) => (
                <View
                  key={kpi.label}
                  className="rounded-sm border border-border bg-card p-3"
                  style={{ width: "47%" }}
                >
                  <Text className="text-xs text-muted-foreground mb-1">{kpi.label}</Text>
                  <Text className="text-xl font-bold" style={{ color: KPI_COLOR_MAP[kpi.label] ?? COLORS.navy }}>
                    {kpi.value}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Anomaly alert banner */}
          {anomalyCount > 0 && (
            <Pressable
              className="mx-4 mt-4 rounded-sm p-4 flex-row items-center gap-3 active:opacity-80"
              style={{ backgroundColor: `${COLORS.brickRed}12`, borderWidth: 1, borderColor: `${COLORS.brickRed}40` }}
              onPress={() => router.push("/(app)/(officer)/anomalies")}
            >
              <AlertTriangle size={20} color={COLORS.brickRed} />
              <View className="flex-1">
                <Text className="font-bold" style={{ color: COLORS.brickRed }}>
                  {anomalyCount} Anomaly{anomalyCount !== 1 ? " Flags" : " Flag"} Detected
                </Text>
                <Text className="text-xs text-muted-foreground">Tap to review — requires administrative attention</Text>
              </View>
              <ChevronRight size={16} color={COLORS.brickRed} />
            </Pressable>
          )}

          {/* Scheme Table Preview */}
          <View className="mx-4 mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-bold text-foreground">Scheme-wise Utilization</Text>
              <Pressable onPress={() => router.push("/(app)/(officer)/schemes")}>
                <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>View All →</Text>
              </Pressable>
            </View>
            {districtData.slice(0, 4).map((row) => {
              const pct = (row.allocated_cr as number) > 0
                ? ((row.utilized_cr as number) / (row.allocated_cr as number)) * 100 : 0;
              const isLow = pct < 60;
              return (
                <View
                  key={row.id as string}
                  className="bg-card border border-border rounded-sm p-3 mb-2"
                  style={{ borderLeftWidth: 3, borderLeftColor: isLow ? COLORS.brickRed : "#2E7D32" }}
                >
                  <View className="flex-row items-start justify-between">
                    <Text className="flex-1 text-sm font-semibold text-foreground pr-2" numberOfLines={1}>
                      {row.scheme_name as string}
                    </Text>
                    <View
                      className="px-2 py-0.5 rounded-sm"
                      style={{ backgroundColor: isLow ? `${COLORS.brickRed}15` : "#e8f5e9" }}
                    >
                      <Text className="text-xs font-bold" style={{ color: isLow ? COLORS.brickRed : "#2E7D32" }}>
                        {pct.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row gap-3 mt-1">
                    <Text className="text-xs text-muted-foreground">Alloc: {formatINR(row.allocated_cr as number)}</Text>
                    <Text className="text-xs text-muted-foreground">Used: {formatINR(row.utilized_cr as number)}</Text>
                    <Text className="text-xs text-muted-foreground">Benef: {formatBeneficiaries(row.beneficiaries as number)}</Text>
                  </View>
                  <View className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                    <View
                      className="h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, pct)}%`, backgroundColor: isLow ? COLORS.brickRed : "#2E7D32" }}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Navigation Cards */}
          <View className="px-4 mt-4 mb-2">
            <Text className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">Modules</Text>
            {navItems.map((item) => (
              <Pressable
                key={item.label}
                className="flex-row items-center gap-3 bg-card border border-border rounded-sm px-4 py-4 mb-3 active:opacity-80"
                onPress={() => router.push(item.route as never)}
                android_ripple={{ color: "rgba(0,0,0,0.04)" }}
              >
                {item.icon}
                <Text className="flex-1 font-semibold text-foreground">{item.label}</Text>
                <ChevronRight size={16} color={COLORS.muted} />
              </Pressable>
            ))}
          </View>

          {/* Logout */}
          <Pressable
            onPress={async () => { await supabase.auth.signOut(); }}
            className="mx-4 mb-10 rounded-sm py-3 flex-row items-center justify-center gap-2 border"
            style={{ borderColor: COLORS.border }}
          >
            <LogOut size={16} color={COLORS.muted} />
            <Text className="text-sm text-muted-foreground">Sign Out</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function FilterRow({
  label, options, selected, onSelect,
}: { label: string; options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-xs text-white/60 w-14">{label}:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-1.5">
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              className="px-3 py-1 rounded-sm border"
              style={{
                backgroundColor: selected === opt ? COLORS.primary : "transparent",
                borderColor: selected === opt ? COLORS.primary : "rgba(255,255,255,0.25)",
              }}
            >
              <Text className="text-xs font-semibold" style={{ color: selected === opt ? "#fff" : "rgba(255,255,255,0.7)" }}>
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
