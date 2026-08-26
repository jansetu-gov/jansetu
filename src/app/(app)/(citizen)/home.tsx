import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Mic, ChevronRight, Search } from "lucide-react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useApp } from "@/lib/appContext";
import { useSession } from "@/ctx";
import {
  CATEGORY_ICONS,
  COLORS,
  DEMO_BADGE,
  LANGUAGES,
  LIFECYCLE_STEPS,
  SCHEME_CATEGORIES,
  T,
  getCategoryLabel,
  getLifecycleLabel,
} from "@/lib/constants";
import { searchSchemesByIntent } from "@/db/api";

// Translate spoken/typed query INTO English before intent-matching
const VOICE_TRANSLATE_MAP: Record<string, string> = {
  hi: "hi", bn: "bn", mr: "mr", gu: "gu", ta: "ta", te: "te",
  kn: "kn", pa: "pa", ml: "ml", ur: "ur", ne: "ne",
};

// Locale tags for speech recognition (web + native)
const MIC_LOCALE_MAP: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", as: "as-IN", bn: "bn-IN", mr: "mr-IN",
  gu: "gu-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", pa: "pa-IN",
  or: "or-IN", ur: "ur-IN", ne: "ne-NP", ml: "ml-IN",
};

// Intent keyword extraction
function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const keywordMap: Record<string, string[]> = {
    farmer: ["farmer", "kisan", "kheti", "zameen", "fasal", "agriculture", "krishi", "खेती", "किसान", "কৃষি"],
    agriculture: ["agriculture", "crop", "farming", "खेती", "कृषि", "চাহ", "কৃষি"],
    housing: ["house", "home", "awaas", "housing", "shelter", "मकान", "घर", "গৃহ"],
    health: ["health", "hospital", "medical", "doctor", "sehat", "स्वास्थ्य", "স্বাস্থ্য"],
    education: ["education", "school", "study", "scholarship", "padhai", "पढ़ाई", "শিক্ষা"],
    women: ["women", "girl", "beti", "mahila", "महिला", "মহিলা"],
    employment: ["job", "employment", "work", "nrega", "rozgar", "रोजगार", "কাজ"],
    msme: ["business", "enterprise", "loan", "mudra", "msme", "shop", "व्यापार", "ব্যবসা"],
    senior: ["old", "senior", "pension", "elderly", "बुजुर्ग", "প্রবীণ"],
    rural: ["rural", "village", "gram", "gaon", "गांव", "গ্রাম"],
    financial: ["financial", "money", "help", "sahay", "paisa", "मदद", "সাহায়তা", "পয়সা"],
    income: ["income", "salary", "wage", "aay", "आय", "আয়"],
  };

  const found = new Set<string>();
  for (const [key, triggers] of Object.entries(keywordMap)) {
    if (triggers.some((t) => lower.includes(t))) found.add(key);
  }
  // Also push raw words
    const words = lower.split(/\s+/).filter((w) => w.length > 1);
  words.forEach((w) => found.add(w));
  return Array.from(found);
}

// Match explanation
function getMatchReason(scheme: Record<string, unknown>, keywords: string[]): string {
  const reasons: string[] = [];
  const category = (scheme.category as string).toLowerCase();
  if (keywords.includes("farmer") || keywords.includes("agriculture") || keywords.includes("financial")) {
    if (category === "agriculture") reasons.push("Matches agricultural financial assistance need");
  }
  if (keywords.includes("housing")) {
    if (category === "housing") reasons.push("Matches housing requirement");
  }
  if (keywords.includes("health")) {
    if (category === "health") reasons.push("Matches health support need");
  }
  if (keywords.includes("women") || keywords.includes("girl")) {
    if (category === "women & child") reasons.push("Matches women & child welfare");
  }
  if (keywords.includes("employment") || keywords.includes("rural")) {
    if (category === "employment" || category === "rural development") reasons.push("Matches employment/rural support");
  }
  if (reasons.length === 0) reasons.push(`Relevant to your ${(scheme.category as string).toLowerCase()} query`);
  return reasons[0];
}

export default function CitizenHome() {
  const { lang, setLang } = useApp();
  const { session } = useSession();
  const router = useRouter();
  const t = T[lang];

  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [translatingQuery, setTranslatingQuery] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Auto-show text fallback on web
  useFocusEffect(
    useCallback(() => {
      if (process.env.EXPO_OS === "web") setShowTextInput(true);
    }, [])
  );

  // Native speech recognition events (no-op on web)
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript;
    if (transcript) {
      setQuery(transcript);
      setListening(false);
      handleSearch(transcript);
    }
  });
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", () => {
    setListening(false);
    setShowTextInput(true);
  });

  async function handleSearch(text: string) {
    if (!text.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      let queryText = text;
      const srcCode = VOICE_TRANSLATE_MAP[lang];
      if (srcCode && lang !== "en") {
        setTranslatingQuery(true);
        try {
          const res = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcCode}|en`
          );
          const json = await res.json();
          if (json?.responseData?.translatedText) {
            queryText = json.responseData.translatedText;
          }
        } catch {
          // translation failed — fall back to raw text
        }
        setTranslatingQuery(false);
      }
      const keywords = extractKeywords(queryText);
      const data = await searchSchemesByIntent(keywords);
      setResults(data.map((s) => ({ ...s, _matchReason: getMatchReason(s, keywords) })));
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function handleMicPress() {
    if (process.env.EXPO_OS === "web") {
      // Web Speech API attempt, fallback to text input
      type SRCtor = new () => {
        lang: string;
        onstart: () => void;
        onresult: (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
      const win = typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>)
        : null;
      if (win && ("SpeechRecognition" in win || "webkitSpeechRecognition" in win)) {
        const SR = (win["SpeechRecognition"] ?? win["webkitSpeechRecognition"]) as SRCtor;
        const recognition = new SR();
        recognition.lang = MIC_LOCALE_MAP[lang] ?? "hi-IN";
        recognition.onstart = () => setListening(true);
        recognition.onresult = (e) => {
          const transcript = e.results[0][0].transcript;
          setQuery(transcript);
          setListening(false);
          handleSearch(transcript);
        };
        recognition.onerror = () => { setListening(false); setShowTextInput(true); };
        recognition.onend = () => setListening(false);
        recognition.start();
      } else {
        setShowTextInput(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } else {
      // Native (Android/iOS) speech recognition
      try {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!result.granted) {
          setShowTextInput(true);
          return;
        }
        setListening(true);
        ExpoSpeechRecognitionModule.start({
          lang: MIC_LOCALE_MAP[lang] ?? "hi-IN",
          interimResults: false,
          continuous: false,
        });
      } catch {
        setListening(false);
        setShowTextInput(true);
      }
    }
  }

  const matchPct = (score: unknown) => {
    const s = typeof score === "number" ? score : 0;
    return Math.min(98, Math.max(55, 50 + s * 6));
  };

  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      {/* Hero Header */}
      <View className="px-5 pt-14 pb-6" style={{ backgroundColor: COLORS.navy }}>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-2xl font-bold text-white">{t.appName}</Text>
          <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${COLORS.primary}30` }}>
            <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>{DEMO_BADGE}</Text>
          </View>
        </View>
        <Text className="text-sm text-white/70 mb-4">{t.findMySchemes}</Text>

        {/* Language Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {LANGUAGES.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => setLang(l.code)}
                className="px-3 py-1.5 rounded-sm border"
                style={{
                  backgroundColor: lang === l.code ? COLORS.primary : "transparent",
                  borderColor: lang === l.code ? COLORS.primary : "rgba(255,255,255,0.3)",
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: lang === l.code ? "#fff" : "rgba(255,255,255,0.7)" }}
                >
                  {l.nativeLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Voice / Text Search */}
      <View className="px-5 py-6 bg-card border-b border-border">
        <Text className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">
          VoiceGov Sahayak
        </Text>

        {/* Big Mic Button */}
        <Pressable
          onPress={handleMicPress}
          className="rounded-sm items-center justify-center py-5 mb-3 active:opacity-80"
          style={{ backgroundColor: listening ? `${COLORS.primary}20` : `${COLORS.primary}10`, borderWidth: 2, borderColor: listening ? COLORS.primary : `${COLORS.primary}40` }}
          android_ripple={{ color: `${COLORS.primary}20` }}
        >
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-2"
            style={{ backgroundColor: listening ? COLORS.primary : `${COLORS.primary}15` }}
          >
            <Mic size={28} color={listening ? "#fff" : COLORS.primary} />
          </View>
          <Text className="font-bold text-base" style={{ color: COLORS.primary }}>
            {listening ? t.listening : t.speakToSearch}
          </Text>
          <Text className="text-xs text-muted-foreground mt-1 text-center px-4">
            {t.voicePromptHint}
          </Text>
        </Pressable>

        {translatingQuery && (
          <Text className="text-xs text-center mb-2" style={{ color: COLORS.primary }}>
            Translating your query...
          </Text>
        )}

        {/* Text Fallback */}
        {(showTextInput || process.env.EXPO_OS === "web") && (
          <View className="flex-row gap-2 items-center">
            <TextInput
              ref={inputRef}
              className="flex-1 border border-border rounded-sm px-4 py-3 text-foreground bg-background"
              placeholder={t.orTypeHere}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={() => handleSearch(query)}
            />
            <Pressable
              className="rounded-sm p-3 items-center justify-center"
              style={{ backgroundColor: COLORS.primary }}
              onPress={() => handleSearch(query)}
            >
              <Search size={20} color="#fff" />
            </Pressable>
          </View>
        )}
        {!showTextInput && process.env.EXPO_OS !== "web" && (
          <Pressable onPress={() => setShowTextInput(true)}>
            <Text className="text-center text-sm" style={{ color: COLORS.primary }}>
              {t.orTypeHere}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Search Results */}
      {searching && (
        <View className="py-8 items-center">
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text className="text-muted-foreground text-sm mt-2">Finding relevant schemes...</Text>
        </View>
      )}

      {searched && !searching && results.length > 0 && (
        <View className="px-5 py-4">
          <Text className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">
            {results.length} schemes matched your query
          </Text>
          {results.map((scheme) => {
            const score = scheme.score as number;
            const pct = matchPct(score);
            return (
              <Pressable
                key={scheme.id as string}
                className="mb-3 bg-card border border-border rounded-sm active:opacity-80"
                onPress={() => router.push(`/(app)/scheme/${scheme.id}`)}
                android_ripple={{ color: "rgba(0,0,0,0.04)" }}
              >
                <View className="p-4">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-lg">{CATEGORY_ICONS[scheme.category as string] ?? "📋"}</Text>
                        <View className="bg-accent rounded-sm px-2 py-0.5">
                          <Text className="text-xs font-semibold text-muted-foreground">
                            {getCategoryLabel(scheme.category as string, lang)}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-base font-bold text-foreground">{scheme.name as string}</Text>
                      <Text className="text-sm text-muted-foreground mt-0.5">{scheme.department as string}</Text>
                    </View>
                    {/* Match % Badge */}
                    <View
                      className="w-14 h-14 rounded-sm items-center justify-center"
                      style={{ backgroundColor: pct >= 80 ? "#e8f5e9" : pct >= 65 ? "#fff8e1" : "#fff3e0" }}
                    >
                      <Text
                        className="text-lg font-bold"
                        style={{ color: pct >= 80 ? "#2E7D32" : pct >= 65 ? "#F57F17" : COLORS.primary }}
                      >
                        {pct}%
                      </Text>
                      <Text className="text-xs text-muted-foreground">match</Text>
                    </View>
                  </View>
                  <Text className="text-sm text-foreground mt-2" numberOfLines={2}>
                    {scheme.description as string}
                  </Text>
                  <View className="mt-2 flex-row items-center gap-1">
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.primary }} />
                    <Text className="text-xs text-muted-foreground flex-1">
                      {scheme._matchReason as string}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
                    <Text className="text-sm font-semibold" style={{ color: COLORS.primary }}>
                      Key Benefit: {(scheme.benefits as string).slice(0, 60)}...
                    </Text>
                    <ChevronRight size={16} color={COLORS.primary} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {searched && !searching && results.length === 0 && (
        <View className="py-12 items-center px-6">
          <Text className="text-4xl mb-3">🔍</Text>
          <Text className="text-lg font-bold text-foreground text-center">No matching schemes found</Text>
          <Text className="text-sm text-muted-foreground text-center mt-1">
            Try browsing categories below or use different keywords
          </Text>
        </View>
      )}

      {/* Category Shortcuts */}
      <View className="px-5 py-4">
        <Text className="text-base font-bold text-foreground mb-3">Browse by Category</Text>
        <View className="flex-row flex-wrap gap-2">
          {SCHEME_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              className="flex-row items-center gap-1.5 border border-border rounded-sm px-3 py-2 bg-card active:opacity-70"
              onPress={() => router.push({ pathname: "/(app)/(citizen)/search", params: { category: cat } })}
            >
              <Text className="text-base">{CATEGORY_ICONS[cat]}</Text>
              <Text className="text-sm font-medium text-foreground">{getCategoryLabel(cat, lang)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Lifecycle Strip */}
      <View className="mx-5 mb-6 bg-card border border-border rounded-sm p-4">
        <Text className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">
          Scheme Lifecycle
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row items-center gap-1">
            {LIFECYCLE_STEPS.map((step, i) => (
              <View key={step} className="flex-row items-center">
                <View
                  className="px-2 py-1 rounded-sm"
                  style={{ backgroundColor: i === 0 ? `${COLORS.primary}18` : "#f1f5f9" }}
                >
                  <Text className="text-xs font-semibold"
                    style={{ color: i === 0 ? COLORS.primary : COLORS.navy }}>
                    {getLifecycleLabel(step, lang)}
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
    </ScrollView>
  );
}
