import React, { useEffect, useState, useRef } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { navigateAfterAuth } from "@/lib/navigateAfterAuth";
import * as Linking from "expo-linking";
import {
  completeAuthFromUrl,
  stripAuthFromBrowserUrl,
} from "@/lib/completeAuthFromUrl";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/common";
import { Colors, Typography } from "@/theme";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import {
  createUserProfileIfNeeded,
  isEmailConfirmed,
  signupMetaFromSession,
  syncSignupMetadataToSupabase,
} from "@/lib/postSignupVerification";

/**
 * Supabase email confirmation and OAuth return URL.
 * Parses `#access_token` / `?code=` and persists the session, then defers to `/` (auth stage gate).
 */
export default function AuthCallbackScreen() {
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const handled = useRef(false);

  useEffect(() => {
    const sub =
      Platform.OS === "web"
        ? null
        : Linking.addEventListener("url", (event) => {
            void run(event.url);
          });

    void run(null);

    return () => {
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(incoming: string | null) {
    if (handled.current) return;

    if (Platform.OS === "web") {
      const r = await completeAuthFromUrl(null);
      if (r.ok) {
        stripAuthFromBrowserUrl();
        handled.current = true;
        await navigateAfterAuth(router);
        return;
      }
      setMessage(r.error);
      setStatus("error");
      return;
    }

    const url = incoming ?? (await Linking.getInitialURL());
    const r = await completeAuthFromUrl(url);
    if (r.ok) {
      handled.current = true;
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session && isEmailConfirmed(sess.session)) {
        const meta = signupMetaFromSession(sess.session);
        await createUserProfileIfNeeded(sess.session, meta);
        await syncSignupMetadataToSupabase(sess.session, meta);
      }
      await navigateAfterAuth(router);
      return;
    }

    const { data: again } = await supabase.auth.getSession();
    if (again.session) {
      handled.current = true;
      if (isEmailConfirmed(again.session)) {
        const meta = signupMetaFromSession(again.session);
        await createUserProfileIfNeeded(again.session, meta);
        await syncSignupMetadataToSupabase(again.session, meta);
      }
      await navigateAfterAuth(router);
      return;
    }

    if (!url) {
      setMessage(
        "No sign-in link was opened. If you tapped a link in email, try again, or use the 6-digit code in the app.",
      );
    } else {
      setMessage(r.error);
    }
    setStatus("error");
  }

  return (
    <View style={styles.container}>
      {status === "loading" && (
        <>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.text}>Finishing sign-in…</Text>
        </>
      )}
      {status === "error" && message && (
        <>
          <Text style={styles.title}>Couldn’t complete sign-in</Text>
          <Text style={styles.text}>{message}</Text>
          <Button
            label="Back to sign in"
            onPress={() => router.replace("/auth/welcome")}
            variant="primary"
            size="lg"
            style={{ marginTop: 20 }}
          />
        </>
      )}
      {__DEV__ && status === "error" ? (
        <Text style={styles.hint} selectable>
          Dev: register this in Supabase → Authentication → URL Configuration → Redirect
          URLs:{"\n"}
          {getAuthRedirectUrl()}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBlack,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    lineHeight: 22,
    marginTop: 12,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    marginTop: 24,
  },
});
