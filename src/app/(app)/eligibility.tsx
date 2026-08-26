import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle } from "lucide-react-native";
import { useApp } from "@/lib/appContext";
import { COLORS } from "@/lib/constants";
import { fetchSchemes } from "@/db/api";

type Question = {
  key: string;
  label: string;
  options: string[];
};

const QUESTIONS: Question[] = [
  { key: "age", label: "What is your age group?", options: ["Below 18", "18–35", "36–60", "Above 60"] },
  { key: "income", label: "What is your approximate annual family income?", options: ["Below ₹1 Lakh", "₹1–2 Lakh", "₹2–5 Lakh", "Above ₹5 Lakh"] },
  { key: "occupation", label: "What is your primary occupation?", options: ["Farmer", "Daily Wage Worker", "Self Employed / Business", "Student", "Government / Private Job", "Homemaker / None"] },
  { key: "gender", label: "What is your gender?", options: ["Male", "Female", "Other"] },
  { key: "state", label: "Which state do you live in?", options: ["Assam", "Bihar", "Jharkhand", "West Bengal", "Uttar Pradesh", "Maharashtra", "Other"] },
  { key: "land", label: "Do you own agricultural land?", options: ["Yes, < 2 acres", "Yes, 2–5 acres", "Yes, > 5 acres", "No land"] },
];

function computeMatch(scheme: Record<string, unknown>, answers: Record<string, string>): number {
  let score = 0;
  const total = 5;

  // Age
  if (answers.age) {
    const ageMin = scheme.eligibility_age_min as number | null;
    const ageMax = scheme.eligibility_age_max as number | null;
    const ageMap: Record<string, number> = { "Below 18": 14, "18–35": 26, "36–60": 48, "Above 60": 65 };
    const userAge = ageMap[answers.age] ?? 30;
    if (!ageMin || userAge >= ageMin) score++;
    if (!ageMax || userAge <= ageMax) score++;
  }

  // Income
  if (answers.income) {
    const incomeLimit = scheme.eligibility_income_limit as number | null;
    const incomeMap: Record<string, number> = {
      "Below ₹1 Lakh": 100000,
      "₹1–2 Lakh": 150000,
      "₹2–5 Lakh": 350000,
      "Above ₹5 Lakh": 600000,
    };
    const userIncome = incomeMap[answers.income] ?? 200000;
    if (!incomeLimit || userIncome <= incomeLimit) score++;
  }

  // Occupation
  if (answers.occupation) {
    const occ = scheme.eligibility_occupation as string[] | null;
    if (!occ || occ.length === 0) {
      score++;
    } else {
      const lower = answers.occupation.toLowerCase();
      if (occ.some((o) => lower.includes(o.toLowerCase()) || o.toLowerCase().includes(lower.split(" ")[0]))) score++;
    }
  }

  // Category affinity
  const cat = (scheme.category as string).toLowerCase();
  if (answers.occupation === "Farmer" && cat === "agriculture") score++;
  if (answers.gender === "Female" && cat === "women & child") score++;
  if (answers.age === "Above 60" && cat === "senior citizens") score++;
  if (answers.occupation === "Student" && (cat === "education" || cat === "scholarships")) score++;
  if (answers.occupation?.includes("Business") && cat === "msme") score++;

  return Math.round(Math.min(98, Math.max(20, (score / total) * 100)));
}

export default function EligibilityScreen() {
  const router = useRouter();
  const { lang } = useApp();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Array<{ scheme: Record<string, unknown>; pct: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAnswer(key: string, value: string) {
    const newAnswers = { ...answers, [key]: value };
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setStep((s) => s + 1);
    } else {
      // Compute results
      setLoading(true);
      const schemes = await fetchSchemes();
      const scored = schemes
        .map((s) => ({ scheme: s, pct: computeMatch(s, newAnswers) }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 8);
      setResults(scored);
      setDone(true);
      setLoading(false);
    }
  }

  function restart() {
    setStep(0);
    setAnswers({});
    setResults([]);
    setDone(false);
  }

  const pctColor = (pct: number) =>
    pct >= 80 ? "#2E7D32" : pct >= 60 ? "#F57F17" : COLORS.muted;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 bg-card border-b border-border flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={22} color={COLORS.navy} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-foreground">Eligibility Questionnaire</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text className="text-muted-foreground">Finding matching schemes...</Text>
        </View>
      ) : !done ? (
        <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1">
          {/* Progress */}
          <View className="px-5 pt-5 pb-2">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm text-muted-foreground">Question {step + 1} of {QUESTIONS.length}</Text>
              <Text className="text-sm font-semibold" style={{ color: COLORS.primary }}>
                {Math.round(((step) / QUESTIONS.length) * 100)}% complete
              </Text>
            </View>
            <View className="h-2 bg-muted rounded-full overflow-hidden">
              <View
                className="h-2 rounded-full"
                style={{ width: `${((step) / QUESTIONS.length) * 100}%`, backgroundColor: COLORS.primary }}
              />
            </View>
          </View>

          <View className="px-5 pt-4">
            <Text className="text-xl font-bold text-foreground mb-6">
              {QUESTIONS[step].label}
            </Text>
            <View className="gap-3">
              {QUESTIONS[step].options.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => handleAnswer(QUESTIONS[step].key, opt)}
                  className="border rounded-sm p-4 active:opacity-80"
                  style={{ borderColor: COLORS.border }}
                  android_ripple={{ color: `${COLORS.primary}10` }}
                >
                  <Text className="text-base font-medium text-foreground">{opt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <View className="px-5 pt-5 pb-2">
            <View className="flex-row items-center gap-2 mb-1">
              <CheckCircle size={20} color="#2E7D32" />
              <Text className="text-xl font-bold text-foreground">Personalized Results</Text>
            </View>
            <Text className="text-sm text-muted-foreground mb-4">
              Based on your answers, here are the most relevant schemes for you.
            </Text>

            {results.map(({ scheme, pct }, i) => (
              <Pressable
                key={scheme.id as string}
                className="bg-card border border-border rounded-sm p-4 mb-3 active:opacity-80"
                onPress={() => router.push(`/(app)/scheme/${scheme.id}`)}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    {i === 0 && (
                      <View className="mb-1 self-start px-2 py-0.5 rounded-sm" style={{ backgroundColor: "#e8f5e9" }}>
                        <Text className="text-xs font-bold" style={{ color: "#2E7D32" }}>🏆 Best Match</Text>
                      </View>
                    )}
                    <Text className="text-base font-bold text-foreground">{scheme.name as string}</Text>
                    <Text className="text-xs text-muted-foreground">{scheme.department as string}</Text>
                    <Text className="text-sm text-foreground mt-1" numberOfLines={2}>
                      {scheme.benefits as string}
                    </Text>
                  </View>
                  <View
                    className="w-14 h-14 rounded-sm items-center justify-center"
                    style={{ backgroundColor: `${pctColor(pct)}18` }}
                  >
                    <Text className="text-lg font-bold" style={{ color: pctColor(pct) }}>{pct}%</Text>
                    <Text className="text-xs text-muted-foreground">match</Text>
                  </View>
                </View>
              </Pressable>
            ))}

            <Pressable
              onPress={restart}
              className="mt-2 mb-10 rounded-sm py-3 items-center border"
              style={{ borderColor: COLORS.navy }}
            >
              <Text className="font-semibold" style={{ color: COLORS.navy }}>↺ Redo Questionnaire</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
