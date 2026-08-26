import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useColorScheme } from "nativewind";
import { LogOut, Globe, Type, Moon } from "lucide-react-native";
import { useApp } from "@/lib/appContext";
import { useSession } from "@/ctx";
import { supabase } from "@/client/supabase";
import { COLORS, LANGUAGES, LangCode, T } from "@/lib/constants";
import { fetchProfile, updateProfile } from "@/db/api";

export default function ProfileTab() {
  const { lang, setLang, largeFonts, setLargeFonts } = useApp();
  const { session } = useSession();
  const router = useRouter();
  const t = T[lang];
  const { colorScheme, setColorScheme } = useColorScheme();

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user.id) return;
      fetchProfile(session.user.id)
        .then(setProfile)
        .finally(() => setLoading(false));
    }, [session?.user.id])
  );

  async function handleLangChange(code: string) {
    setLang(code as LangCode);
    if (session?.user.id) {
      await updateProfile(session.user.id, { language: code });
    }
  }

  function handleDarkModeToggle(value: boolean) {
    setColorScheme(value ? "dark" : "light");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      {/* Header */}
      <View className="px-5 pt-14 pb-6 bg-card border-b border-border">
        <View className="flex-row items-center gap-4">
          <View
            className="w-16 h-16 rounded-full items-center justify-center"
            style={{ backgroundColor: `${COLORS.primary}18` }}
          >
            <Text className="text-3xl">🙋</Text>
          </View>
          <View>
            <Text className="text-xl font-bold text-foreground">
              {(profile?.display_name as string) ?? (profile?.username as string) ?? "Citizen"}
            </Text>
            <Text className="text-sm text-muted-foreground">{session?.user.email?.replace("@miaoda.com", "")}</Text>
            <View className="mt-1 px-2 py-0.5 rounded-sm self-start" style={{ backgroundColor: `${COLORS.primary}18` }}>
              <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>Citizen</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Language */}
      <View className="mx-4 mt-5 bg-card border border-border rounded-sm p-4">
        <View className="flex-row items-center gap-2 mb-3">
          <Globe size={16} color={COLORS.navy} />
          <Text className="font-bold text-foreground">{t.language}</Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => handleLangChange(l.code)}
              className="px-3 py-2 rounded-sm border"
              style={{
                backgroundColor: lang === l.code ? COLORS.primary : "#fff",
                borderColor: lang === l.code ? COLORS.primary : COLORS.border,
              }}
            >
              <Text
                className="font-semibold text-sm"
                style={{ color: lang === l.code ? "#fff" : COLORS.navy }}
              >
                {l.nativeLabel}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Dark Mode */}
      <View className="mx-4 mt-3 bg-card border border-border rounded-sm px-4 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Moon size={16} color={COLORS.navy} />
          <Text className="font-bold text-foreground">Dark Mode</Text>
        </View>
        <Switch
          value={colorScheme === "dark"}
          onValueChange={handleDarkModeToggle}
          trackColor={{ true: COLORS.primary, false: COLORS.border }}
          thumbColor="#fff"
        />
      </View>

      {/* Large Fonts */}
      <View className="mx-4 mt-3 bg-card border border-border rounded-sm px-4 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Type size={16} color={COLORS.navy} />
          <Text className="font-bold text-foreground">Large Fonts (Accessibility)</Text>
        </View>
        <Switch
          value={largeFonts}
          onValueChange={setLargeFonts}
          trackColor={{ true: COLORS.primary, false: COLORS.border }}
          thumbColor="#fff"
        />
      </View>

      {/* Logout */}
      <Pressable
        onPress={handleLogout}
        className="mx-4 mt-4 rounded-sm py-4 flex-row items-center justify-center gap-2 active:opacity-80"
        style={{ backgroundColor: COLORS.brickRed }}
      >
        <LogOut size={18} color="#fff" />
        <Text className="text-white font-bold text-base">{t.logout}</Text>
      </Pressable>

      <Text className="text-center text-xs text-muted-foreground mt-6 mb-10 px-6">
        JanSetu Gov — Demo Mode{"\n"}Citizen Interface v1.0
      </Text>
    </ScrollView>
  );
}