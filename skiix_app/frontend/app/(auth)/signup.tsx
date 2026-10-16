import { Redirect } from "expo-router";

/** Sign-up UI is at `/auth/register` (after choose-role). This preserves the `(auth)` route. */
export default function SignUpRoute() {
  return <Redirect href="/auth/register" />;
}
