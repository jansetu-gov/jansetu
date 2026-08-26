import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { BookMarked, ChevronRight, ClipboardList } from "lucide-react-native";
import { useApp } from "@/lib/appContext";
import { useSession } from "@/ctx";
import { COLORS, T } from "@/lib/constants";
import { fetchBookmarks, fetchApplications } from "@/db/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted:    { label: "Submitted",    color: "#1976D2", bg: "#E3F2FD" },
  under_review: { label: "Under Review", color: "#F57F17", bg: "#FFF8E1" },
  approved:     { label: "Approved",     color: "#2E7D32", bg: "#E8F5E9" },
  disbursed:    { label: "Disbursed",    color: "#6A1B9A", bg: "#F3E5F5" },
};

type TabKey = "bookmarks" | "applications";

export default function MySchemes() {
  const { lang } = useApp();
  const { session } = useSession();
  const t = T[lang];
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("bookmarks");
  const [bookmarks, setBookmarks] = useState<Record<string, unknown>[]>([]);
  const [applications, setApplications] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user.id) return;
      setLoading(true);
      Promise.all([
        fetchBookmarks(session.user.id),
        fetchApplications(session.user.id),
      ])
        .then(([bm, apps]) => {
          setBookmarks(bm);
          setApplications(apps);
        })
        .finally(() => setLoading(false));
    }, [session?.user.id])
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-5 pt-14 pb-4 bg-card border-b border-border">
        <Text className="text-xl font-bold text-foreground">{t.mySchemes}</Text>
        <View className="flex-row gap-3 mt-3">
          {(["bookmarks", "applications"] as TabKey[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-sm border"
              style={{
                backgroundColor: activeTab === tab ? COLORS.primary : "#fff",
                borderColor: activeTab === tab ? COLORS.primary : COLORS.border,
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: activeTab === tab ? "#fff" : COLORS.navy }}
              >
                {tab === "bookmarks" ? `Saved (${bookmarks.length})` : `Applications (${applications.length})`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : activeTab === "bookmarks" ? (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item.scheme_id as string}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View className="py-16 items-center gap-3">
              <BookMarked size={48} color={COLORS.muted} />
              <Text className="text-base font-semibold text-foreground">No saved schemes yet</Text>
              <Text className="text-sm text-muted-foreground">Bookmark schemes from Search tab</Text>
            </View>
          }
          renderItem={({ item }) => {
            const scheme = item.schemes as Record<string, unknown>;
            if (!scheme) return null;
            return (
              <Pressable
                className="bg-card border border-border rounded-sm p-4 active:opacity-80"
                onPress={() => router.push(`/(app)/scheme/${scheme.id}`)}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-foreground">{scheme.name as string}</Text>
                    <Text className="text-xs text-muted-foreground">{scheme.department as string}</Text>
                    <Text className="text-sm text-foreground mt-1" numberOfLines={2}>
                      {scheme.benefits as string}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={COLORS.muted} />
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id as string}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={
            <View className="mb-2 px-3 py-2 rounded-sm" style={{ backgroundColor: `${COLORS.primary}10` }}>
              <Text className="text-xs text-muted-foreground">
                ⚠️ Demo Mode — These are simulated application records for demonstration purposes only.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View className="py-16 items-center gap-3">
              <ClipboardList size={48} color={COLORS.muted} />
              <Text className="text-base font-semibold text-foreground">No applications yet</Text>
              <Text className="text-sm text-muted-foreground">Apply for schemes from the scheme detail page</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = STATUS_CONFIG[item.status as string] ?? STATUS_CONFIG.submitted;
            return (
              <View className="bg-card border border-border rounded-sm p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-foreground">{item.scheme_name as string}</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">
                      Applied: {new Date(item.submitted_at as string).toLocaleDateString("en-IN")}
                    </Text>
                  </View>
                  <View className="px-2 py-1 rounded-sm" style={{ backgroundColor: cfg.bg }}>
                    <Text className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
