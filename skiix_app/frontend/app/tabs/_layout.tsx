import { Redirect } from "expo-router";

export default function TabsLayout() {
  // This `tabs` group is deprecated in favor of `/(root)/(tabs)`.
  return <Redirect href="/(root)/(tabs)" />;
}
