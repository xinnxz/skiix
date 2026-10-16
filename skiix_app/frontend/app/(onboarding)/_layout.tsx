import { Stack } from "expo-router";

/**
 * Onboarding flow group — runs immediately after signup, before the tabs.
 *
 * Notes:
 * - No tab bar (this layout is outside the `(root)/(tabs)` group on purpose).
 * - Step 1: no back swipe (can't return to auth). Steps 2–4: swipe back to previous step.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: "#0A0A0A" },
      }}
    >
      <Stack.Screen name="step1" options={{ gestureEnabled: false }} />
      <Stack.Screen name="step2" />
      <Stack.Screen name="step3" />
      <Stack.Screen name="step4" />
    </Stack>
  );
}
