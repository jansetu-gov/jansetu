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
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/client/supabase";
import { COLORS } from "@/lib/constants";
import { useApp } from "@/lib/appContext";

type AuthMode = "login" | "register";

export default function SignIn() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { setSelectedRole } = useApp();

  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  const currentRole = (role as "citizen" | "officer") ?? "citizen";

  async function handleLogin() {
    setError("");
    if (!username.trim() || !password) { setError("Username and password are required."); return; }
    setLoading(true);
    const email = `${username.trim().toLowerCase()}@miaoda.com`;
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) setError(e.message);
    else {
      setSelectedRole(currentRole);
      router.replace("/");
    }
    setLoading(false);
  }

  async function handleRegister() {
    setError("");
    if (!username.trim() || !password) { setError("Username and password are required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (!phone.trim() || phone.trim().length < 10) { setError("Please enter a valid 10-digit mobile number."); return; }
    if (!agreed) { setError("Please agree to the User Agreement and Privacy Policy."); return; }
    setLoading(true);
    const { data, error: e } = await supabase.functions.invoke("register-user", {
      body: { username: username.trim().toLowerCase(), password, role: currentRole, phone: phone.trim() },
    });
    if (e || data?.error) {
      const msg = data?.error ?? (await e?.context?.text()) ?? e?.message ?? "Registration failed.";
      setError(msg);
    } else {
      await supabase.auth.setSession(data.session);
      setSelectedRole(currentRole);
      router.replace("/");
    }
    setLoading(false);
  }

  const roleLabel = currentRole === "officer" ? "Government Officer" : "Citizen";
  const roleColor = currentRole === "officer" ? COLORS.navy : COLORS.primary;

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-sm items-center justify-center mb-4"
            style={{ backgroundColor: `${roleColor}18` }}>
            <Text className="text-4xl">{currentRole === "officer" ? "🏛️" : "🙋"}</Text>
          </View>
          <Text className="text-2xl font-bold text-foreground">JanSetu Gov</Text>
          <View className="mt-1 px-3 py-0.5 rounded-sm" style={{ backgroundColor: `${roleColor}18` }}>
            <Text className="text-sm font-semibold" style={{ color: roleColor }}>{roleLabel}</Text>
          </View>
        </View>

        {/* Mode toggle */}
        <View className="flex-row mb-6 bg-muted rounded-sm p-1">
          {(["login", "register"] as AuthMode[]).map((m) => (
            <Pressable
              key={m}
              className="flex-1 py-2 rounded-sm items-center"
              style={{ backgroundColor: mode === m ? "#fff" : "transparent" }}
              onPress={() => { setMode(m); setError(""); }}
            >
              <Text className="font-semibold text-sm"
                style={{ color: mode === m ? COLORS.navy : COLORS.muted }}>
                {m === "login" ? "Sign In" : "Register"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Username */}
        <Text className="text-sm font-semibold text-foreground mb-1">Username</Text>
        <TextInput
          className="border border-border rounded-sm px-4 py-3 mb-4 text-foreground bg-card"
          placeholder="Enter username (letters, digits, _)"
          value={username}
          onChangeText={(v) => setUsername(v.replace(/[^a-zA-Z0-9_]/g, ""))}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />

        {/* Phone (register only) */}
        {mode === "register" && (
          <>
            <Text className="text-sm font-semibold text-foreground mb-1">Mobile Number</Text>
            <TextInput
              className="border border-border rounded-sm px-4 py-3 mb-4 text-foreground bg-card"
              placeholder="10-digit mobile number"
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, "").slice(0, 10))}
              keyboardType="number-pad"
              maxLength={10}
              returnKeyType="next"
            />
          </>
        )}

        {/* Password */}
        <Text className="text-sm font-semibold text-foreground mb-1">Password</Text>
        <View className="flex-row border border-border rounded-sm mb-4 bg-card">
          <TextInput
            className="flex-1 px-4 py-3 text-foreground"
            placeholder="Enter password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
            returnKeyType="done"
            onSubmitEditing={mode === "login" ? handleLogin : handleRegister}
          />
          <Pressable onPress={() => setShowPwd((v) => !v)} className="px-4 justify-center">
            <Text className="text-muted-foreground text-sm">{showPwd ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>

        {/* Agreement (register only) */}
        {mode === "register" && (
          <Pressable
            className="flex-row items-center gap-2 mb-4"
            onPress={() => setAgreed((v) => !v)}
          >
            <View
              className="w-5 h-5 rounded-sm border-2 items-center justify-center"
              style={{ borderColor: agreed ? COLORS.primary : COLORS.border, backgroundColor: agreed ? COLORS.primary : "#fff" }}
            >
              {agreed && <Text className="text-white text-xs font-bold">✓</Text>}
            </View>
            <Text className="text-sm text-muted-foreground flex-1">
              I agree to the{" "}
              <Text className="underline" style={{ color: COLORS.primary }}>User Agreement</Text>
              {" & "}
              <Text className="underline" style={{ color: COLORS.primary }}>Privacy Policy</Text>
            </Text>
          </Pressable>
        )}

        {/* Error */}
        {!!error && <Text className="text-destructive text-sm mb-4">{error}</Text>}

        {/* Submit */}
        <Pressable
          className="rounded-sm py-4 items-center active:opacity-80"
          style={{ backgroundColor: roleColor }}
          onPress={mode === "login" ? handleLogin : handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">
              {mode === "login" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </Pressable>

        {/* Back */}
        <Pressable className="mt-4 items-center" onPress={() => router.back()}>
          <Text className="text-sm text-muted-foreground">← Back to role selection</Text>
        </Pressable>

        <Text className="text-center text-xs text-muted-foreground mt-8">
          Demo Mode — All accounts are for demonstration only.{"\n"}
          Please modify User Agreement &amp; Privacy Policy yourself.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
