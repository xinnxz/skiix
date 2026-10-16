import { Redirect } from "expo-router";

export default function LegacySignUpRedirect() {
  // Legacy route kept for backwards-compatibility.
  // Real sign-up (with OTP verification) lives under `/auth/*`.
  return <Redirect href="/auth/choose-role" />;
}
