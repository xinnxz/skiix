import { Redirect } from "expo-router";

/** Legacy route — redirect to the 4-step onboarding flow. */
export default function OnboardingRedirect() {
  return <Redirect href="/(onboarding)/step1" />;
}
