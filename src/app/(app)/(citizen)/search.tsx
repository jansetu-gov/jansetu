import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Search as SearchIcon, ChevronRight, BookmarkIcon } from "lucide-react-native";
import { useApp } from "@/lib/appContext";
import { useSession } from "@/ctx";
import { CATEGORY_ICONS, COLORS, SCHEME_CATEGORIES, T, getCategoryLabel } from "@/lib/constants";
import { fetchSchemes, toggleBookmark, isBookmarked } from "@/db/api";

export default function SearchTab() {
  const router = useRouter();
  const { lang } = useApp();
  const { session } = useSession();
  const t = T[lang];
  const params = useLocalSearchParams<{ category?: string }>();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(params.category ?? "");
  const [schemes, setSchemes] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const loadSchemes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSchemes(category || undefined, query || undefined);
      setSchemes(data);
    } finally {
      setLoading(false);
    }
  }, [category, query]);

  useFocusEffect(useCallback(() => { loadSchemes(); }, [loadSchemes]));

  async function handleBookmark(schemeId: string) {
    if (!session?.user.id) return;
    const isNowBookmarked = await toggleBookmark(session.user.id, schemeId);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      isNowBookmarked ? next.add(schemeId) : next.delete(schemeId);
      return next;
    });
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-14 pb-3 bg-card border-b border-border">
               <Text className="text-xl font-bold text-foreground mb-3">{t.searchSchemes}</Text>
        <View className="flex-row items-center border border-border rounded-sm bg-background px-3 gap-2">
          <SearchIcon size={18} color={COLORS.muted} />
          <TextInput
            className="flex-1 py-3 text-foreground"
            placeholder={t.searchSchemes}
            value={query}
            onChangeText={(v) => { setQuery(v); }}
            returnKeyType="search"
            onSubmitEditing={loadSchemes}
          />
        </View>
        {/* Category chips */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["", ...SCHEME_CATEGORIES]}
          keyExtractor={(item) => item}
          style={{ marginTop: 10 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setCategory(item)}
              className="mr-2 px-3 py-1.5 rounded-sm border"
              style={{
                backgroundColor: category === item ? COLORS.primary : "#fff",
                borderColor: category === item ? COLORS.primary : COLORS.border,
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: category === item ? "#fff" : COLORS.navy }}
              >
                                {item === "" ? "All" : `${CATEGORY_ICONS[item] ?? ""} ${getCategoryLabel(item, lang)}`}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={schemes}
          keyExtractor={(item) => item.id as string}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View className="py-16 items-center">
              <Text className="text-4xl mb-3">🔍</Text>
              <Text className="text-base font-semibold text-foreground">No schemes found</Text>
              <Text className="text-sm text-muted-foreground mt-1">Try a different search or category</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isBm = bookmarkedIds.has(item.id as string);
            return (
              <Pressable
                className="bg-card border border-border rounded-sm active:opacity-80"
                onPress={() => router.push(`/(app)/scheme/${item.id}`)}
                android_ripple={{ color: "rgba(0,0,0,0.04)" }}
              >
                <View className="p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text>{CATEGORY_ICONS[item.category as string] ?? "📋"}</Text>
                        <View className="bg-accent px-2 py-0.5 rounded-sm">
                                                <Text className="text-xs text-muted-foreground font-semibold">{getCategoryLabel(item.category as string, lang)}</Text>
                        </View>
                      </View>
                      <Text className="text-base font-bold text-foreground">{item.name as string}</Text>
                      <Text className="text-xs text-muted-foreground">{item.department as string}</Text>
                    </View>
                    <Pressable
                      onPress={() => handleBookmark(item.id as string)}
                      className="p-2"
                      hitSlop={8}
                    >
                      <BookmarkIcon
                        size={20}
                        color={isBm ? COLORS.primary : COLORS.muted}
                        fill={isBm ? COLORS.primary : "transparent"}
                      />
                    </Pressable>
                  </View>
                  <Text className="text-sm text-foreground mt-2" numberOfLines={2}>
                    {item.description as string}
                  </Text>
                  <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
                    <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                      Benefit: {(item.benefits as string).slice(0, 50)}...
                    </Text>
                    <ChevronRight size={14} color={COLORS.muted} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

