import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/ctx";

export default function AppIndex() {
  const { role, roleLoading } = useSession();

  if (roleLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (role === "officer") return <Redirect href="/(officer)/overview" />;
  if (role === "public") return <Redirect href="/(public)/transparency" />;
  return <Redirect href="/(citizen)/home" />;
}