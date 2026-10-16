import { Redirect } from "expo-router";

/**
 * Legacy route: onboarding is now the single-screen feed personalize flow.
 */
export default function OnboardingRedirect() {
  return <Redirect href="/personalize" />;
}
