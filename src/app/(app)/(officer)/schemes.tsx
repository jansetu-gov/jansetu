import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft, Edit2, Check, X } from "lucide-react-native";
import { COLORS, DEMO_BADGE, FINANCIAL_YEARS, STATES_DISTRICTS, formatINR } from "@/lib/constants";
import { fetchDistrictData, updateDistrictData } from "@/db/api";

export default function SchemesManagement() {
  const router = useRouter();

  const [selectedState, setSelectedState]       = useState("Assam");
  const [selectedDistrict, setSelectedDistrict] = useState("Kamrup");
  const [selectedFY, setSelectedFY]             = useState("2024-25");
  const [schemes, setSchemes]                   = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [editingId, setEditingId]               = useState<string | null>(null);
  const [editValues, setEditValues]             = useState<Record<string, string>>({});
  const [saving, setSaving]                     = useState(false);
  const [saveMsg, setSaveMsg]                   = useState("");

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchDistrictData(selectedState, selectedDistrict, undefined, selectedFY)
        .then(setSchemes)
        .finally(() => setLoading(false));
    }, [selectedState, selectedDistrict, selectedFY])
  );

  function startEdit(row: Record<string, unknown>) {
    setEditingId(row.id as string);
    setEditValues({
      allocated_cr:  String(row.allocated_cr),
      released_cr:   String(row.released_cr),
      utilized_cr:   String(row.utilized_cr),
      beneficiaries: String(row.beneficiaries),
      physical_progress_pct: String(row.physical_progress_pct),
    });
    setSaveMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await updateDistrictData(id, {
        allocated_cr:          parseFloat(editValues.allocated_cr  || "0"),
        released_cr:           parseFloat(editValues.released_cr   || "0"),
        utilized_cr:           parseFloat(editValues.utilized_cr   || "0"),
        beneficiaries:         parseInt(editValues.beneficiaries   || "0"),
        physical_progress_pct: parseFloat(editValues.physical_progress_pct || "0"),
      });
      setSchemes((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, ...{
                allocated_cr:          parseFloat(editValues.allocated_cr),
                released_cr:           parseFloat(editValues.released_cr),
                utilized_cr:           parseFloat(editValues.utilized_cr),
                beneficiaries:         parseInt(editValues.beneficiaries),
                physical_progress_pct: parseFloat(editValues.physical_progress_pct),
              }}
            : s
        )
      );
      setSaveMsg("✅ Saved successfully");
      setEditingId(null);
    } catch {
      setSaveMsg("❌ Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 bg-card border-b border-border flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={8}><ArrowLeft size={22} color={COLORS.navy} /></Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">Scheme Management</Text>
          <Text className="text-xs text-muted-foreground">Edit fund utilization data</Text>
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

      {!!saveMsg && (
        <View className="mx-4 mt-3 p-3 rounded-sm" style={{ backgroundColor: saveMsg.includes("✅") ? "#e8f5e9" : `${COLORS.brickRed}10` }}>
          <Text className="text-sm font-semibold" style={{ color: saveMsg.includes("✅") ? "#2E7D32" : COLORS.brickRed }}>{saveMsg}</Text>
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={schemes}
          keyExtractor={(item) => item.id as string}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListHeaderComponent={
            <Text className="text-xs text-muted-foreground mb-2">
              {schemes.length} schemes in {selectedDistrict} · Tap ✏️ to edit utilization data
            </Text>
          }
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Text className="text-base font-semibold text-foreground">No schemes found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const pct = (item.allocated_cr as number) > 0
              ? ((item.utilized_cr as number) / (item.allocated_cr as number)) * 100 : 0;
            const isEditing = editingId === item.id;

            return (
              <View
                className="bg-card border border-border rounded-sm overflow-hidden"
                style={{ borderLeftWidth: 3, borderLeftColor: pct < 60 ? COLORS.brickRed : "#2E7D32" }}
              >
                {/* Title row */}
                <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
                  <Text className="flex-1 text-sm font-bold text-foreground pr-2" numberOfLines={1}>
                    {item.scheme_name as string}
                  </Text>
                  {!isEditing ? (
                    <Pressable onPress={() => startEdit(item)} hitSlop={8}>
                      <Edit2 size={16} color={COLORS.primary} />
                    </Pressable>
                  ) : (
                    <View className="flex-row gap-3">
                      <Pressable onPress={() => saveEdit(item.id as string)} disabled={saving} hitSlop={8}>
                        {saving ? <ActivityIndicator size="small" color="#2E7D32" /> : <Check size={18} color="#2E7D32" />}
                      </Pressable>
                      <Pressable onPress={cancelEdit} hitSlop={8}>
                        <X size={18} color={COLORS.brickRed} />
                      </Pressable>
                    </View>
                  )}
                </View>

                <View className="px-4 pb-4">
                  {!isEditing ? (
                    <>
                      <View className="flex-row gap-3 flex-wrap mb-2">
                        <Text className="text-xs text-muted-foreground">Alloc: {formatINR(item.allocated_cr as number)}</Text>
                        <Text className="text-xs text-muted-foreground">Released: {formatINR(item.released_cr as number)}</Text>
                        <Text className="text-xs text-muted-foreground">Used: {formatINR(item.utilized_cr as number)}</Text>
                        <Text className="text-xs text-muted-foreground">Benef: {item.beneficiaries as number}</Text>
                        <Text className="text-xs text-muted-foreground">Physical: {item.physical_progress_pct as number}%</Text>
                      </View>
                      <View className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <View className="h-1.5 rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: pct < 60 ? COLORS.brickRed : "#2E7D32" }} />
                      </View>
                      <Text className="text-xs mt-1" style={{ color: pct < 60 ? COLORS.brickRed : "#2E7D32" }}>
                        {pct.toFixed(1)}% utilized
                      </Text>
                    </>
                  ) : (
                    <View className="gap-2">
                      {[
                        { key: "allocated_cr",          label: "Allocated (₹ Cr)" },
                        { key: "released_cr",           label: "Released (₹ Cr)" },
                        { key: "utilized_cr",           label: "Utilized (₹ Cr)" },
                        { key: "beneficiaries",         label: "Beneficiaries" },
                        { key: "physical_progress_pct", label: "Physical Progress %" },
                      ].map(({ key, label }) => (
                        <View key={key} className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted-foreground w-32">{label}:</Text>
                          <TextInput
                            className="flex-1 border border-border rounded-sm px-2 py-1.5 text-sm text-foreground bg-background"
                            value={editValues[key]}
                            onChangeText={(v) => setEditValues((prev) => ({ ...prev, [key]: v }))}
                            keyboardType="numeric"
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
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
