import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(citizen)" />
      <Stack.Screen name="(officer)" />
      <Stack.Screen name="scheme" />
      <Stack.Screen name="eligibility" />
    </Stack>
  );
}
