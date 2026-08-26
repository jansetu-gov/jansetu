import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { CheckCircle } from "lucide-react-native";
import { COLORS, DEMO_BADGE } from "@/lib/constants";
import { submitRTIQuery } from "@/db/api";

type FormState = {
  name: string;
  contact: string;
  subject: string;
  description: string;
};

type FormErrors = Partial<FormState>;

export default function RTIScreen() {
  const [form, setForm] = useState<FormState>({ name: "", contact: "", subject: "", description: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState("");
  const [submitError, setSubmitError] = useState("");

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.name.trim())        e.name        = "Name is required";
    if (!form.contact.trim())     e.contact     = "Contact is required";
    if (!form.subject.trim())     e.subject     = "Subject is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (form.contact.trim() && !/^[\w.+\-@]+$/.test(form.contact) && !/^\d{10}$/.test(form.contact.replace(/\s/g, ""))) {
      e.contact = "Enter a valid email or 10-digit phone number";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const ref = await submitRTIQuery(form.name, form.contact, form.subject, form.description);
      setRefNumber(ref);
      setSubmitted(true);
    } catch (err) {
      setSubmitError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setForm({ name: "", contact: "", subject: "", description: "" });
    setErrors({});
    setSubmitted(false);
    setRefNumber("");
    setSubmitError("");
  }

  if (submitted) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full items-center justify-center mb-5" style={{ backgroundColor: "#e8f5e9" }}>
          <CheckCircle size={44} color="#2E7D32" />
        </View>
        <Text className="text-2xl font-bold text-foreground text-center mb-2">Query Submitted</Text>
        <Text className="text-sm text-muted-foreground text-center mb-6">
          Your RTI-style query has been received. Keep the reference number for follow-up.
        </Text>
        <View className="bg-card border border-border rounded-sm w-full p-5 items-center mb-5">
          <Text className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Reference Number</Text>
          <Text className="text-2xl font-bold" style={{ color: COLORS.primary }}>{refNumber}</Text>
          <Text className="text-xs text-muted-foreground text-center mt-3">
            ⚠️ Demo Mode — This is a simulated reference number for demonstration purposes.
          </Text>
        </View>
        <View className="bg-accent rounded-sm p-4 w-full mb-5">
          <Text className="text-sm text-foreground">
            <Text className="font-bold">Subject:</Text> {form.subject}
          </Text>
          <Text className="text-sm text-muted-foreground mt-1">Submitted by: {form.name}</Text>
        </View>
        <Pressable
          onPress={handleReset}
          className="rounded-sm py-3 px-8 items-center border"
          style={{ borderColor: COLORS.navy }}
        >
          <Text className="font-semibold" style={{ color: COLORS.navy }}>Submit Another Query</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : "height"} className="flex-1">
      <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="px-5 pt-14 pb-5" style={{ backgroundColor: COLORS.navy }}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xl font-bold text-white">RTI Query</Text>
            <View className="px-2 py-0.5 rounded-sm" style={{ backgroundColor: `${COLORS.primary}30` }}>
              <Text className="text-xs font-semibold" style={{ color: COLORS.primary }}>{DEMO_BADGE}</Text>
            </View>
          </View>
          <Text className="text-sm text-white/70">
            Right to Information — Submit a public query about government scheme implementation
          </Text>
        </View>

        <View className="px-5 py-5 gap-4">
          {/* Info Box */}
          <View className="bg-card border border-border rounded-sm p-4">
            <Text className="text-sm font-bold text-foreground mb-2">What is an RTI Query?</Text>
            <Text className="text-sm text-muted-foreground leading-5">
              Under the Right to Information Act, citizens can seek information about government programmes. Submit your query below. You will receive a reference number.
            </Text>
            <Text className="text-xs italic text-muted-foreground mt-2">
              ⚠️ This is a demo form. No real RTI is filed through this application.
            </Text>
          </View>

          {/* Form Fields */}
          <FormField
            label="Your Name"
            placeholder="Enter your full name"
            value={form.name}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            error={errors.name}
            required
          />
          <FormField
            label="Contact (Phone or Email)"
            placeholder="10-digit mobile or email address"
            value={form.contact}
            onChangeText={(v) => setForm((f) => ({ ...f, contact: v }))}
            error={errors.contact}
            keyboardType="email-address"
            required
          />
          <FormField
            label="Subject"
            placeholder="e.g., Fund utilization under PM-KISAN in Kamrup district"
            value={form.subject}
            onChangeText={(v) => setForm((f) => ({ ...f, subject: v }))}
            error={errors.subject}
            required
          />
          <FormField
            label="Description"
            placeholder="Describe your query in detail..."
            value={form.description}
            onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
            error={errors.description}
            multiline
            required
          />

          {submitError ? (
            <Text className="text-sm text-center" style={{ color: COLORS.brickRed }}>{submitError}</Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            className="rounded-sm py-4 items-center active:opacity-80 mt-2"
            style={{ backgroundColor: COLORS.primary }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Submit Query</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormField({
  label, placeholder, value, onChangeText, error, multiline, keyboardType, required,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  required?: boolean;
}) {
  return (
    <View>
      <Text className="text-sm font-semibold text-foreground mb-1.5">
        {label}{required && <Text style={{ color: COLORS.brickRed }}> *</Text>}
      </Text>
      <TextInput
        className={`border rounded-sm px-4 py-3 text-foreground bg-background ${error ? "border-destructive" : "border-border"}`}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={keyboardType ?? "default"}
        style={{ minHeight: multiline ? 100 : undefined }}
      />
      {!!error && <Text className="text-xs mt-1" style={{ color: COLORS.brickRed }}>{error}</Text>}
    </View>
  );
}
