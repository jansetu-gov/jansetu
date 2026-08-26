import { useRouter } from "expo-router";
import { ScrollView, Text, View, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useApp } from "@/lib/appContext";
import { COLORS, LIFECYCLE_STEPS, T } from "@/lib/constants";

const ROLES = [
  {
    key: "citizen" as const,
    emoji: "🙋",
    color: COLORS.primary,
    route: "/(auth)/sign-in?role=citizen",
  },
  {
    key: "officer" as const,
    emoji: "🏛️",
    color: COLORS.navy,
    route: "/(auth)/sign-in?role=officer",
  },
  {
    key: "public" as const,
    emoji: "👁️",
    color: "#2E7D32",
    route: "/(public)/transparency",
  },
];

const cardShadow = {
  shadowColor: "#0A192F",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

export default function LandingScreen() {
  const router = useRouter();
  const { lang, setSelectedRole } = useApp();
  const t = T[lang];

  function handleRole(role: (typeof ROLES)[number]) {
    setSelectedRole(role.key);
    router.push(role.route as never);
  }

  function getRoleLabel(key: "citizen" | "officer" | "public") {
    if (key === "public") return t.publicViewer;
    return t[key as keyof typeof t];
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="pb-12"
      contentInsetAdjustmentBehavior="automatic"
    >
      <StatusBar style="light" backgroundColor="#0A192F" />

      {/* Hero */}
      <LinearGradient
        colors={["#0A192F", "#050B16"] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 64, paddingBottom: 36, paddingHorizontal: 24, alignItems: "center" }}
      >
        {/* Emblem */}
        <View
          className="w-16 h-16 rounded-full items-center justify-center mb-4"
          style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)" }}
        >
          <Text className="text-white font-bold text-lg tracking-widest">JS</Text>
        </View>

        <Text className="text-4xl font-bold text-white text-center">{t.appName}</Text>

        {/* Tricolour accent bar */}
        <LinearGradient
          colors={[COLORS.primary, "#FFFFFF", COLORS.success] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: 56, height: 3, marginTop: 10, marginBottom: 14, borderRadius: 2 }}
        />

        <Text className="text-base text-white/80 text-center">{t.tagline}</Text>

        <View
          className="mt-5 px-3 py-1 rounded-sm"
          style={{ backgroundColor: "rgba(255,107,53,0.2)", borderWidth: 1, borderColor: "rgba(255,107,53,0.4)" }}
        >
          <Text className="text-xs font-semibold" style={{ color: "#FF9466" }}>
            ● Demo Mode — Synthetic Data
          </Text>
        </View>
      </LinearGradient>

      {/* Letterhead double-rule */}
      <View>
        <View style={{ height: 3, backgroundColor: COLORS.primary }} />
        <View style={{ height: 1, backgroundColor: COLORS.border }} />
      </View>

      {/* Role Selection */}
      <View className="px-6 mt-8">
        <Text className="text-xl font-bold text-foreground mb-1">{t.selectRole}</Text>
        <Text className="text-sm text-muted-foreground mb-5">
          Choose how you want to use JanSetu Gov
        </Text>

        {ROLES.map((role, i) => (
          <Animated.View
            key={role.key}
            entering={FadeInDown.delay(i * 90).duration(400).springify().damping(14)}
          >
            <Pressable
              className="mb-4 rounded-lg bg-card overflow-hidden active:opacity-80"
              style={cardShadow}
              onPress={() => handleRole(role)}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            >
              <View className="flex-row">
                <View style={{ width: 4, backgroundColor: role.color }} />
                <View className="flex-1 p-5 flex-row items-center gap-4">
                  <View
                    className="w-14 h-14 rounded-lg items-center justify-center"
                    style={{ backgroundColor: `${role.color}18` }}
                  >
                    <Text className="text-3xl">{role.emoji}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-foreground">
                      {getRoleLabel(role.key)}
                    </Text>
                    <Text className="text-sm text-muted-foreground mt-0.5">
                      {role.key === "citizen" && "Discover schemes, check eligibility, apply"}
                      {role.key === "officer" && "Track funds, monitor utilization, review anomalies"}
                      {role.key === "public" && "View fund utilization & accountability data"}
                    </Text>
                  </View>
                  <Text className="text-xl" style={{ color: role.color }}>›</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      {/* Lifecycle Strip */}
      <Animated.View entering={FadeIn.delay(350).duration(500)}>
        <View className="mx-6 mt-6 bg-card border border-border rounded-lg p-4" style={cardShadow}>
          <Text className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Government Scheme Lifecycle
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row items-center gap-1">
              {LIFECYCLE_STEPS.map((step, i) => (
                <View key={step} className="flex-row items-center">
                  <View
                    className="px-2 py-1 rounded-sm"
                    style={{ backgroundColor: i === 0 ? `${COLORS.primary}18` : "#f1f5f9" }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: i === 0 ? COLORS.primary : COLORS.navy }}
                    >
                      {step}
                    </Text>
                  </View>
                  {i < LIFECYCLE_STEPS.length - 1 && (
                    <Text className="text-muted-foreground text-xs mx-0.5">→</Text>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Animated.View>

      {/* Footer note */}
      <Text className="text-center text-xs text-muted-foreground mt-8 px-6">
        JanSetu Gov — Hackathon MVP Demo{"\n"}All data is synthetic. Not affiliated with Government of India.
      </Text>
    </ScrollView>
  );
}