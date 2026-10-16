import { Redirect } from "expo-router";

export default function TabsHomeRedirect() {
  // Keep `/tabs` as a backwards-compatible alias, but make the “real” app live under `/(root)/(tabs)`.
  return <Redirect href="/(root)/(tabs)" />;
}
