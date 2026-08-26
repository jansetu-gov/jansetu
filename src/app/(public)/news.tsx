import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Newspaper, Calendar } from "lucide-react-native";
import { COLORS, DEMO_BADGE } from "@/lib/constants";
import { fetchNews } from "@/db/api";

type NewsItem = {
  id: string;
  title: string;
  content: string;
  published_at: string;
  category?: string;
  source?: string;
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  announcement: { bg: `${COLORS.primary}15`,   color: COLORS.primary },
  policy:       { bg: `${COLORS.navy}12`,       color: COLORS.navy },
  alert:        { bg: `${COLORS.brickRed}12`,   color: COLORS.brickRed },
  update:       { bg: "#e8f5e9",                color: "#2E7D32" },
};

export default function NewsScreen() {
  const [news, setNews]         = useState<NewsItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNews()
        .then((items) => setNews(items as NewsItem[]))
        .finally(() => setLoading(false));
    }, [])
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-5 pt-14 pb-5" style={{ backgroundColor: COLORS.navy }}>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-xl font-bold text-white">News & Updates</Text>
          <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${COLORS.primary}30` }}>
            <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>{DEMO_BADGE}</Text>
          </View>
        </View>
        <Text className="text-xs text-white/70">Government scheme announcements and policy updates</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={news}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View className="py-16 items-center gap-3">
              <Newspaper size={48} color={COLORS.muted} />
              <Text className="text-base font-semibold text-foreground">No news items</Text>
              <Text className="text-sm text-muted-foreground">Check back later for updates</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isExpanded = expanded === item.id;
            const categoryCfg = CATEGORY_COLORS[item.category ?? "update"] ?? CATEGORY_COLORS.update;

            return (
              <Pressable
                className="bg-card border border-border rounded-sm overflow-hidden active:opacity-90"
                onPress={() => setExpanded(isExpanded ? null : item.id)}
                android_ripple={{ color: "rgba(0,0,0,0.04)" }}
              >
                {/* Category bar */}
                <View className="h-1" style={{ backgroundColor: categoryCfg.color }} />

                <View className="p-4">
                  {/* Category + Date */}
                  <View className="flex-row items-center justify-between mb-2">
                    {item.category && (
                      <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: categoryCfg.bg }}>
                        <Text className="text-xs font-bold uppercase" style={{ color: categoryCfg.color }}>
                          {item.category}
                        </Text>
                      </View>
                    )}
                    <View className="flex-row items-center gap-1 ml-auto">
                      <Calendar size={12} color={COLORS.muted} />
                      <Text className="text-xs text-muted-foreground">{formatDate(item.published_at)}</Text>
                    </View>
                  </View>

                  {/* Title */}
                  <Text className="text-base font-bold text-foreground mb-1">{item.title}</Text>

                  {/* Source */}
                  {item.source && (
                    <Text className="text-xs text-muted-foreground mb-2">Source: {item.source}</Text>
                  )}

                  {/* Content — collapsed/expanded */}
                  <Text
                    className="text-sm text-foreground leading-5"
                    numberOfLines={isExpanded ? undefined : 3}
                  >
                    {item.content}
                  </Text>

                  {/* Read more / Less */}
                  <Text className="text-xs font-semibold mt-2" style={{ color: COLORS.primary }}>
                    {isExpanded ? "Show less ▲" : "Read more ▼"}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
