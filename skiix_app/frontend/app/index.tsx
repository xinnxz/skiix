import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/store/auth.store";
import { Colors } from "@/theme";
import { getOnboardingStep } from "@/utils/onboardingProgress";

type OnboardingHref =
  | "/(onboarding)/step1"
  | "/(onboarding)/step2"
  | "/(onboarding)/step3"
  | "/(onboarding)/step4";

export default function Index() {
  const { isLoading, stage } = useAuth();
  const [resumeHref, setResumeHref] = useState<OnboardingHref | null>(null);
  const [resumeReady, setResumeReady] = useState(false);

  // If returning user force-closed mid-onboarding, resume at the saved step.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (stage !== "needs_onboarding") {
        setResumeReady(true);
        return;
      }
      const step = await getOnboardingStep();
      if (cancelled) return;
      const href: OnboardingHref =
        step === 4
          ? "/(onboarding)/step4"
          : step === 3
            ? "/(onboarding)/step3"
            : step === 2
              ? "/(onboarding)/step2"
              : "/(onboarding)/step1";
      setResumeHref(href);
      setResumeReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  // While auth is resolving, avoid sending users to /welcome (login success was racing here).
  if (isLoading || !resumeReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.bgBlack,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (stage === "guest" || stage === "boot") {
    return <Redirect href="/auth/welcome" />;
  }
  if (stage === "needs_profile") {
    return <Redirect href="/auth/profile-setup" />;
  }
  if (stage === "needs_onboarding") {
    return <Redirect href={resumeHref ?? "/(onboarding)/step1"} />;
  }
  return <Redirect href="/(root)/(tabs)" />;
}
