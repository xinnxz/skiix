import { Redirect } from "expo-router";

export default function LegacySignInRedirect() {
  // Legacy route kept for backwards-compatibility.
  // Real auth flow (including OTP) lives under `/auth/*`.
  return <Redirect href="/auth/login" />;
}
