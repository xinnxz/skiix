import type { Router } from "expo-router";
import { supabase } from "@/lib/supabase";
import {
  getSessionForRefresh,
  isOnboardingComplete,
} from "@/services/supabaseAuthService";
import { setOnboardingStep } from "@/utils/onboardingProgress";
import {
  createUserProfileIfNeeded,
  isEmailConfirmed,
  type SignupMeta,
} from "@/lib/postSignupVerification";

/** After sign-in / email confirm: onboarding flow first, then home via `/`. */
export async function navigateAfterAuth(
  router: Router,
  opts?: { ensureProfile?: boolean; signupMeta?: Partial<SignupMeta> },
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  let session = data.session ?? null;

  if (session && opts?.ensureProfile && isEmailConfirmed(session)) {
    await createUserProfileIfNeeded(session, opts.signupMeta);
    session = (await getSessionForRefresh()) ?? session;
  } else if (session) {
    session = (await getSessionForRefresh()) ?? session;
  }

  if (session && !isOnboardingComplete(session)) {
    await setOnboardingStep(1);
    router.replace("/(onboarding)/step1");
    return;
  }

  setTimeout(() => {
    router.replace("/");
  }, 32);
}
