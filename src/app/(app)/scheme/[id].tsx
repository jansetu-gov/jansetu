import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { ArrowLeft, Bookmark, CheckCircle, FileText, ExternalLink, MapPin, Volume2, VolumeX, MessageSquareText } from "lucide-react-native";
import * as Speech from "expo-speech";
import Animated, { ZoomIn, FadeInDown } from "react-native-reanimated";
import { useApp } from "@/lib/appContext";
import { useSession } from "@/ctx";
import { CATEGORY_ICONS, COLORS, DEMO_DATASET_LABEL, T } from "@/lib/constants";
import { fetchSchemeById, isBookmarked, toggleBookmark, createApplication, logSimulatedSms } from "@/db/api";

const TRANSLATE_TARGET_MAP: Record<string, string> = {
  hi: "hi", bn: "bn", mr: "mr", gu: "gu", ta: "ta", te: "te",
  kn: "kn", pa: "pa", ml: "ml", ur: "ur", ne: "ne",
};

const SPEECH_LOCALE_MAP: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", bn: "bn-IN", mr: "mr-IN", gu: "gu-IN",
  ta: "ta-IN", te: "te-IN", kn: "kn-IN", pa: "pa-IN", ml: "ml-IN",
  ur: "ur-IN", ne: "ne-NP", as: "as-IN", or: "or-IN",
};

const SEP = " ||| ";

async function translateBlob(text: string, targetCode: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetCode}`
    );
    const json = await res.json();
    return json?.responseData?.translatedText ?? null;
  } catch {
    return null;
  }
}

type TranslatedContent = {
  name: string;
  description: string;
  benefits: string;
  documents: string[];
  steps: string[];
};

export default function SchemeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useApp();
  const { session } = useSession();
  const t = T[lang];

  type SchemeRow = {
    name: string;
    department: string;
    category: string;
    description: string;
    state_availability: string[];
    eligibility_income_limit: number | null;
    eligibility_age_min: number | null;
    eligibility_age_max: number | null;
    eligibility_occupation: string[] | null;
    benefits: string;
    required_documents: string[];
    application_process: string[];
    application_url: string | null;
    csc_info: string | null;
    last_updated: string | null;
    [key: string]: unknown;
  };
  const [scheme, setScheme] = useState<SchemeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applicationRef, setApplicationRef] = useState<{ id: string; submitted_at: string } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [smsPreview, setSmsPreview] = useState<string | null>(null);

  const [translated, setTranslated] = useState<TranslatedContent | null>(null);
  const [translatingPage, setTranslatingPage] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setLoading(true);
      Promise.all([
        fetchSchemeById(id),
        session?.user.id ? isBookmarked(session.user.id, id) : Promise.resolve(false),
      ])
        .then(([s, bm]) => { setScheme(s); setBookmarked(bm); })
        .finally(() => setLoading(false));
    }, [id, session?.user.id])
  );

  // Translate the whole page's dynamic content when language changes
  useEffect(() => {
    if (!scheme) return;
    const targetCode = TRANSLATE_TARGET_MAP[lang];
    if (!targetCode || lang === "en") {
      setTranslated(null);
      return;
    }
    let cancelled = false;
    setTranslatingPage(true);
    (async () => {
      const mainBlob = [scheme.name, scheme.description, scheme.benefits].join(SEP);
      const docsBlob = (scheme.required_documents ?? []).join(SEP);
      const stepsBlob = (scheme.application_process ?? []).join(SEP);

      const [mainT, docsT, stepsT] = await Promise.all([
        translateBlob(mainBlob, targetCode),
        translateBlob(docsBlob, targetCode),
        translateBlob(stepsBlob, targetCode),
      ]);
      if (cancelled) return;

      const mainParts = mainT ? mainT.split("|||").map((s) => s.trim()) : [];
      setTranslated({
        name: mainParts[0] || scheme.name,
        description: mainParts[1] || scheme.description,
        benefits: mainParts[2] || scheme.benefits,
        documents: docsT ? docsT.split("|||").map((s) => s.trim()).filter(Boolean) : scheme.required_documents,
        steps: stepsT ? stepsT.split("|||").map((s) => s.trim()).filter(Boolean) : scheme.application_process,
      });
      setTranslatingPage(false);
    })();
    return () => { cancelled = true; };
  }, [scheme, lang]);

  async function handleBookmark() {
    if (!session?.user.id || !id) return;
    const nowBm = await toggleBookmark(session.user.id, id);
    setBookmarked(nowBm);
  }

  function maskedPhone(userId: string) {
    const digits = userId.replace(/[^0-9]/g, "").padEnd(4, "0").slice(0, 4);
    return `+91 9XXXX${digits}`;
  }

  function shortRef(uuid: string) {
    return `APP-${uuid.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  }

  async function handleApply() {
    if (!session?.user.id || !scheme) return;
    setApplying(true);
    try {
      const result = await createApplication(session.user.id, id, scheme.name);
      if (result) {
        setApplicationRef(result);
        const ref = shortRef(result.id);
        const phone = maskedPhone(session.user.id);
        const body = `JanSetu Gov: Your application for "${scheme.name}" is received. Application ID: ${ref}. Track status & upload documents: jansetu.gov.in/track/${ref} (Demo Link). Nearest help centre: ${scheme.csc_info ?? "your local CSC"}. - Team JanSetu`;
        try {
          await logSimulatedSms(session.user.id, result.id, phone, body);
          setSmsPreview(body);
        } catch {
          // SMS log failure shouldn't block the application success flow
        }
      }
      setApplied(true);
    } finally {
      setApplying(false);
    }
  }

  function handleListen() {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    if (!scheme) return;

    const name = translated?.name ?? scheme.name;
    const description = translated?.description ?? scheme.description;
    const benefits = translated?.benefits ?? scheme.benefits;
    const steps = translated?.steps ?? scheme.application_process;

    const summary = [name, description, `${t.benefits}: ${benefits}`, steps?.length ? steps.join(". ") : ""]
      .filter(Boolean)
      .join(". ")
      .slice(0, 480);

    Speech.speak(summary, {
      language: SPEECH_LOCALE_MAP[lang] ?? "en-IN",
      rate: 0.9,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
    setSpeaking(true);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!scheme) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-base font-semibold text-foreground">Scheme not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text style={{ color: COLORS.primary }}>← Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const displayName = translated?.name ?? scheme.name;
  const displayDescription = translated?.description ?? scheme.description;
  const displayBenefits = translated?.benefits ?? scheme.benefits;
  const docs = translated?.documents ?? scheme.required_documents;
  const steps = translated?.steps ?? scheme.application_process;

  return (
    <View className="flex-1 bg-background">
      {/* Header bar */}
      <View className="px-4 pt-14 pb-4 bg-card border-b border-border flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={22} color={COLORS.navy} />
        </Pressable>
        <Text className="flex-1 text-base font-bold text-foreground" numberOfLines={1}>
          {displayName}
        </Text>
        <Pressable onPress={handleListen} hitSlop={8} className="mr-1">
          {speaking ? (
            <VolumeX size={22} color={COLORS.primary} />
          ) : (
            <Volume2 size={22} color={COLORS.navy} />
          )}
        </Pressable>
        <Pressable onPress={handleBookmark} hitSlop={8}>
          <Bookmark
            size={22}
            color={bookmarked ? COLORS.primary : COLORS.muted}
            fill={bookmarked ? COLORS.primary : "transparent"}
          />
        </Pressable>
      </View>

      {translatingPage && (
        <View className="px-4 py-2 items-center" style={{ backgroundColor: "#FFF3E0" }}>
          <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>
            Translating page content...
          </Text>
        </View>
      )}

      <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1">
        {/* Hero */}
        <View className="px-5 py-5" style={{ backgroundColor: COLORS.navy }}>
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-2xl">{CATEGORY_ICONS[scheme.category] ?? "📋"}</Text>
            <View className="bg-white/20 px-2 py-0.5 rounded-sm">
              <Text className="text-xs text-white font-semibold">{scheme.category}</Text>
            </View>
          </View>
          <Text className="text-xl font-bold text-white mb-1">{displayName}</Text>
          <Text className="text-sm text-white/70">{scheme.department}</Text>
          <Text className="text-sm text-white/80 mt-3">{displayDescription}</Text>

          {/* Listen button (prominent, low-literacy friendly) */}
          <Pressable
            onPress={handleListen}
            className="mt-4 flex-row items-center gap-2 self-start px-4 py-2.5 rounded-sm active:opacity-80"
            style={{ backgroundColor: speaking ? COLORS.primary : "rgba(255,255,255,0.15)" }}
          >
            {speaking ? <VolumeX size={16} color="#fff" /> : <Volume2 size={16} color="#fff" />}
            <Text className="text-white text-sm font-bold">
              {speaking ? "Stop Listening" : "🔊 Listen to this scheme"}
            </Text>
          </Pressable>

          {/* Demo label */}
          <View className="mt-3 px-2 py-1 rounded-sm self-start" style={{ backgroundColor: "rgba(255,107,53,0.2)" }}>
            <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>{DEMO_DATASET_LABEL}</Text>
          </View>
        </View>

        {/* Eligibility */}
        <SectionCard title={t.eligibility} icon="✅">
          {scheme.eligibility_income_limit && (
            <InfoRow label="Income Limit" value={`Up to ₹${(scheme.eligibility_income_limit / 100000).toFixed(1)} Lakh per year`} />
          )}
          {scheme.eligibility_age_min && (
            <InfoRow
              label="Age"
              value={`${scheme.eligibility_age_min}${scheme.eligibility_age_max ? ` – ${scheme.eligibility_age_max}` : "+"} years`}
            />
          )}
          {scheme.eligibility_occupation?.length && (
            <InfoRow label="Occupation" value={scheme.eligibility_occupation.join(", ")} />
          )}
          <InfoRow label="State Availability" value={scheme.state_availability.join(", ")} />
          <Pressable
            onPress={() => router.push("/(app)/eligibility")}
            className="mt-3 flex-row items-center gap-1"
          >
            <CheckCircle size={14} color={COLORS.primary} />
            <Text className="text-sm font-semibold" style={{ color: COLORS.primary }}>
              {t.checkEligibility}
            </Text>
          </Pressable>
        </SectionCard>

        {/* Benefits */}
        <SectionCard title={t.benefits} icon="💰">
          <Text className="text-sm text-foreground leading-5">{displayBenefits}</Text>
        </SectionCard>

        {/* Documents */}
        <SectionCard title={t.documents} icon="📄">
          {docs.map((doc, i) => (
            <View key={i} className="flex-row items-start gap-2 mb-1.5">
              <FileText size={14} color={COLORS.primary} />
              <Text className="text-sm text-foreground flex-1">{doc}</Text>
            </View>
          ))}
        </SectionCard>

        {/* Application Process */}
        <SectionCard title="Application Process" icon="📝">
          {steps.map((step, i) => (
            <View key={i} className="flex-row items-start gap-3 mb-3">
              <View
                className="w-6 h-6 rounded-full items-center justify-center mt-0.5"
                style={{ backgroundColor: COLORS.primary }}
              >
                <Text className="text-white text-xs font-bold">{i + 1}</Text>
              </View>
              <Text className="text-sm text-foreground flex-1 leading-5">{step}</Text>
            </View>
          ))}
          {scheme.application_url && (
            <Pressable
              className="flex-row items-center gap-2 mt-2 p-3 rounded-sm border"
              style={{ borderColor: COLORS.primary }}
              onPress={() => Linking.openURL(scheme.application_url!)}
            >
              <ExternalLink size={16} color={COLORS.primary} />
              <Text className="text-sm font-semibold flex-1" style={{ color: COLORS.primary }}>
                Official Portal: {scheme.application_url}
              </Text>
            </Pressable>
          )}
        </SectionCard>

        {/* CSC Info */}
        {scheme.csc_info && (
          <SectionCard title="Help / CSC Centre" icon="📍">
            <View className="flex-row items-start gap-2">
              <MapPin size={16} color={COLORS.navy} />
              <Text className="text-sm text-foreground flex-1">{scheme.csc_info}</Text>
            </View>
          </SectionCard>
        )}

        {/* Apply / Track */}
        <View className="px-5 pb-10 gap-3 mt-2">
          {applied ? (
            <Animated.View entering={FadeInDown.duration(400)}>
              <View
                className="rounded-lg p-5 items-center"
                style={{ backgroundColor: "#e8f5e9", borderWidth: 1, borderColor: "#c8e6c9" }}
              >
                <Animated.View entering={ZoomIn.delay(150).duration(500).springify()}>
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-3"
                    style={{ backgroundColor: "#2E7D32" }}
                  >
                    <CheckCircle size={32} color="#fff" />
                  </View>
                </Animated.View>
                <Text className="text-lg font-bold text-center" style={{ color: "#1B5E20" }}>
                  Application Submitted!
                </Text>
                <Text className="text-sm text-center mt-1" style={{ color: "#2E7D32" }}>
                  Your demo application for {displayName} has been recorded.
                </Text>

                {applicationRef && (
                  <View
                    className="mt-4 px-4 py-2 rounded-md self-stretch items-center"
                    style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#c8e6c9" }}
                  >
                    <Text className="text-xs text-muted-foreground">Application ID</Text>
                    <Text className="text-base font-bold tracking-wider" style={{ color: COLORS.navy }}>
                      {shortRef(applicationRef.id)}
                    </Text>
                  </View>
                )}

                <Pressable
                  className="mt-4 rounded-sm py-3 px-6 self-stretch items-center active:opacity-80"
                  style={{ backgroundColor: "#2E7D32" }}
                  onPress={() => router.push("/(app)/(citizen)/my-schemes")}
                >
                  <Text className="text-white font-bold text-sm">Track My Application →</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <Pressable
              className="rounded-sm py-4 items-center active:opacity-80"
              style={{ backgroundColor: COLORS.primary }}
              onPress={handleApply}
              disabled={applying}
            >
              {applying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">{t.applyNow} (Demo)</Text>
              )}
            </Pressable>
          )}
          {!applied && (
            <Pressable
              className="rounded-sm py-4 items-center border"
              style={{ borderColor: COLORS.navy }}
              onPress={() => router.push("/(app)/(citizen)/my-schemes")}
            >
              <Text className="font-bold text-base" style={{ color: COLORS.navy }}>Track My Application →</Text>
            </Pressable>
          )}

          {/* SMS Simulation Preview */}
          {smsPreview && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View
                className="rounded-lg p-4"
                style={{ backgroundColor: "#F0F4FF", borderWidth: 1, borderColor: "#C7D2FE" }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <MessageSquareText size={16} color={COLORS.navy} />
                  <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.navy }}>
                    SMS Sent (Simulated Demo)
                  </Text>
                </View>
                <Text className="text-sm text-foreground leading-5">{smsPreview}</Text>
              </View>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionCard({
  title, icon, children,
}: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View className="mx-4 mt-3 bg-card border border-border rounded-sm p-4">
      <View className="flex-row items-center gap-2 mb-3 pb-2 border-b border-border">
        <Text className="text-base">{icon}</Text>
        <Text className="text-base font-bold text-foreground">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-2 mb-2">
      <Text className="text-sm text-muted-foreground w-28">{label}:</Text>
      <Text className="text-sm font-semibold text-foreground flex-1">{value}</Text>
    </View>
  );
}
