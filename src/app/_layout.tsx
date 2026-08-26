import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { PortalHost } from "@rn-primitives/portal";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SessionProvider, useSession } from "@/ctx";
import { AppProvider } from "@/lib/appContext";
import { StatusBar } from "expo-status-bar";
import "../global.css";
Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN });
function RootLayoutNav() {
  const { session, isLoading } = useSession();
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }
  return (
    <>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Screen name="(public)" />
      </Stack>
    </>
  );
}
const RootLayout: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <SessionProvider>
          <RootLayoutNav />
          <PortalHost />
        </SessionProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
};
export default Sentry.wrap(RootLayout);
