import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_STEP = "skiix_onboarding_step";
const KEY_DRAFT = "skiix_onboarding_draft";

export type OnboardingDraft = {
  role_tag?: string;
  interests?: string[];
  skills?: string[];
};

export async function getOnboardingStep(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(KEY_STEP);
    const n = v ? Number(v) : 1;
    return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 1;
  } catch {
    return 1;
  }
}

export async function setOnboardingStep(step: 1 | 2 | 3 | 4): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_STEP, String(step));
  } catch {
    // ignore — onboarding can recover from step 1 on next launch.
  }
}

export async function getOnboardingDraft(): Promise<OnboardingDraft> {
  try {
    const raw = await AsyncStorage.getItem(KEY_DRAFT);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function patchOnboardingDraft(
  patch: OnboardingDraft,
): Promise<void> {
  try {
    const cur = await getOnboardingDraft();
    await AsyncStorage.setItem(
      KEY_DRAFT,
      JSON.stringify({ ...cur, ...patch }),
    );
  } catch {
    // ignore
  }
}

export async function clearOnboarding(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY_STEP, KEY_DRAFT]);
  } catch {
    // ignore
  }
}
