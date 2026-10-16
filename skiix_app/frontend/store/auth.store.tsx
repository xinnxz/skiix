import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  useRef,
} from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { completeAuthFromUrl } from "@/lib/completeAuthFromUrl";
import { getAuthRedirectUrl, logAuthRedirectHint } from "@/lib/authRedirect";
import {
  createUserProfileIfNeeded,
  isEmailConfirmed,
  syncSignupMetadataToSupabase,
  signupMetaFromSession,
} from "@/lib/postSignupVerification";
import { UserDTO } from "@/types/user.types";
import { mapProfileToUserDTO } from "@/utils/userProfileMapper";
import { supabase } from "@/lib/supabase";
import {
  loadProfileForUser,
  isMissingProfilesTableMessage,
  getSessionForRefresh,
  signInWithGoogle,
  signOut,
  isEmailNotConfirmedError,
  isOnboardingComplete,
  formatSupabaseAuthError,
} from "@/services/supabaseAuthService";

type Stage = "boot" | "guest" | "needs_profile" | "needs_onboarding" | "authed";

interface AuthState {
  user: UserDTO | null;
  session: Session | null;
  authUser: User | null;
  stage: Stage;
  isLoading: boolean;
  error: string | null;
  /** Role chosen on `choose-role` before signup; cleared after OTP + create-profile or on logout. */
  signupRole: string | null;
}

type AuthAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_FROM_SESSION"; payload: Partial<AuthState> }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_SIGNUP_ROLE"; payload: string | null }
  | { type: "LOGOUT" };

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };
    case "SET_FROM_SESSION": {
      const s = { ...state, ...action.payload, isLoading: false, error: null };
      if (s.stage === "authed" && s.user) {
        s.isLoading = false;
      }
      return s;
    }
    case "SET_SIGNUP_ROLE":
      return { ...state, signupRole: action.payload };
    case "LOGOUT":
      return {
        user: null,
        session: null,
        authUser: null,
        stage: "guest",
        isLoading: false,
        error: null,
        signupRole: null,
      };
    default:
      return state;
  }
}

function computeStage(session: Session | null, hasProfile: boolean): Stage {
  if (!session) return "guest";
  const m = session.user.user_metadata as Record<string, unknown> | null | undefined;
  const onboardingComplete = m?.onboarding_complete === true;
  // New signups: finish 4-step onboarding before profile-setup / home.
  if (!onboardingComplete) return "needs_onboarding";
  if (!hasProfile) return "needs_profile";
  return "authed";
}

type RegisterPayload = {
  email: string;
  password: string;
  username?: string;
  display_name?: string;
  role?: string;
  first_name?: string;
  last_name?: string;
};

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  /** Existing users: email + password. Returns `needs_email_verification` when Supabase requires OTP. */
  login: (p: { email: string; password: string }) => Promise<"ok" | "needs_email_verification">;
  /** New users: sign up. With email confirmations ON, returns `{ needsEmailVerification: true }` and no session yet. */
  register: (p: RegisterPayload) => Promise<{ needsEmailVerification: boolean }>;
  signInWithGoogle: () => Promise<void>;
  completeOnboarding: (p: {
    interests: string[];
    skills?: string[];
    role_tag?: string;
    stage?: string[];
    goals?: string[];
  }) => Promise<void>;
  saveProfile: (p: {
    username: string;
    bio: string;
    avatar_url: string | null;
    location: string | null;
    tagline: string | null;
  }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  updateUser: (user: UserDTO) => void;
  /** Chosen on `/auth/choose-role` before email signup. */
  setSignupRole: (role: string | null) => void;
  /** Refresh app state from the current Supabase session (e.g. after OTP verify). */
  rehydrateSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** If profile fetch fails, still keep the session so the app does not look “logged out”. */
function fallbackStateFromSession(session: Session) {
  const u = session.user;
  const email = u.email ?? "";
  return {
    session,
    authUser: u,
    user: mapProfileToUserDTO({
      id: u.id,
      email,
      created_at: u.created_at ?? new Date().toISOString(),
    }),
    stage: isOnboardingComplete(u) ? ("needs_profile" as const) : ("needs_onboarding" as const),
  };
}

async function mapSessionToState(session: Session | null) {
  if (!session?.user) {
    return { stage: "guest" as const, user: null, session: null, authUser: null };
  }
  const u = session.user;
  const { user: dto, hasProfile } = await loadProfileForUser(u);
  return {
    session,
    authUser: u,
    user: dto,
    stage: computeStage(session, hasProfile),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    user: null,
    session: null,
    authUser: null,
    stage: "boot" as Stage,
    isLoading: true,
    error: null,
    signupRole: null,
  });
  const bootstrapped = useRef(false);

  const refreshFromSession = useCallback(async (session: Session | null) => {
    if (!session) {
      dispatch({
        type: "SET_FROM_SESSION",
        payload: { stage: "guest", user: null, session: null, authUser: null },
      });
      return;
    }
    try {
      const mapped = await mapSessionToState(session);
      dispatch({ type: "SET_FROM_SESSION", payload: mapped });
    } catch (e) {
      console.warn("load profile; using session fallback", e);
      dispatch({
        type: "SET_FROM_SESSION",
        payload: fallbackStateFromSession(session),
      });
    }
  }, []);

  const rehydrateSession = useCallback(async () => {
    const nextSession = (await getSessionForRefresh()) ?? (await supabase.auth.getSession()).data.session;
    await refreshFromSession(nextSession ?? null);
  }, [refreshFromSession]);

  useEffect(() => {
    logAuthRedirectHint();
    (async () => {
      const { data } = await supabase.auth.getSession();
      await refreshFromSession(data.session ?? null);
      bootstrapped.current = true;
    })();
  }, [refreshFromSession]);

  // When the user taps "Confirm your mail" in the inbox, finish sign-in here
  // (callback route also handles this; this covers cold-start before navigation).
  useEffect(() => {
    if (Platform.OS === "web") return;

    const isAuthUrl = (url: string) =>
      /auth\/callback|access_token=|refresh_token=|token_hash=|type=signup|type=email/i.test(
        url,
      );

    const finishFromUrl = async (url: string | null) => {
      if (!url || !isAuthUrl(url)) return;
      const r = await completeAuthFromUrl(url);
      if (r.ok) {
        const { data } = await supabase.auth.getSession();
        const session = data.session ?? null;
        if (session && isEmailConfirmed(session)) {
          const meta = signupMetaFromSession(session);
          await createUserProfileIfNeeded(session, meta);
          await syncSignupMetadataToSupabase(session, meta);
        }
        await refreshFromSession(session);
      }
    };

    void Linking.getInitialURL().then(finishFromUrl);
    const sub = Linking.addEventListener("url", (e) => {
      void finishFromUrl(e.url);
    });
    return () => sub.remove();
  }, [refreshFromSession]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession) => {
        if (event === "SIGNED_OUT") {
          dispatch({ type: "LOGOUT" });
          return;
        }
        if (!bootstrapped.current && event === "INITIAL_SESSION") return;
        await refreshFromSession(newSession);
      },
    );
    return () => sub.subscription.unsubscribe();
  }, [refreshFromSession]);

  const login = useCallback(
    async (p: { email: string; password: string }) => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const email = p.email.trim().toLowerCase();
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: p.password,
        });
        if (error) {
          if (isEmailNotConfirmedError(error)) {
            dispatch({ type: "SET_ERROR", payload: null });
            return "needs_email_verification" as const;
          }
          throw error;
        }
        await refreshFromSession(data.session);
        return "ok" as const;
      } catch (e: any) {
        const m = String(e?.message ?? "");
        const msg =
          /invalid login|invalid email or password|wrong password|invalid credentials/i.test(
            m,
          )
            ? "Invalid email or password."
            : m || "Sign in failed.";
        dispatch({ type: "SET_ERROR", payload: msg });
        dispatch({ type: "SET_LOADING", payload: false });
        throw e;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [refreshFromSession],
  );

  const register = useCallback(
    async (data: RegisterPayload) => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const fullName =
          data.display_name?.trim() ||
          `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();
        const username =
          data.username?.toLowerCase().trim() ||
          data.email.split("@")[0].replace(/[^a-z0-9_]/g, "_").slice(0, 32);
        const email = data.email.trim().toLowerCase();

        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password: data.password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
            data: {
              full_name: fullName.trim(),
              username,
              signup_role: data.role ?? "",
              onboarding_complete: false,
            },
          },
        });

        if (error) {
          const em = error.message.toLowerCase();
          let msg = error.message;
          if (em.includes("already registered") || em.includes("user already")) {
            msg = "Email already registered. Try logging in.";
          } else if (em.includes("rate limit")) {
            msg = "Too many attempts. Please wait a minute.";
          }
          throw new Error(msg);
        }

        if (signUpData.session) {
          await refreshFromSession(signUpData.session);
          return { needsEmailVerification: false };
        }
        return { needsEmailVerification: true };
      } catch (e: unknown) {
        const msg = formatSupabaseAuthError(e);
        if (__DEV__) {
          console.warn("[Signup Error]", e);
        }
        dispatch({ type: "SET_ERROR", payload: msg });
        dispatch({ type: "SET_LOADING", payload: false });
        throw e;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [refreshFromSession],
  );

  const doGoogle = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    const { error } = await signInWithGoogle();
    if (error) {
      dispatch({ type: "SET_ERROR", payload: (error as Error).message });
      return;
    }
    const { data } = await supabase.auth.getSession();
    await refreshFromSession(data.session);
  }, [refreshFromSession]);

  const saveProfile = useCallback(
    async (p: {
      username: string;
      bio: string;
      avatar_url: string | null;
      location: string | null;
      tagline: string | null;
    }) => {
      const { data: s } = await supabase.auth.getSession();
      const session = s.session;
      if (!session?.user) throw new Error("Not signed in");
      dispatch({ type: "SET_LOADING", payload: true });
      const { data: gu, error: getErr } = await supabase.auth.getUser();
      if (getErr) {
        dispatch({ type: "SET_ERROR", payload: getErr.message });
        return;
      }
      const prev = (gu.user?.user_metadata ?? {}) as Record<string, unknown>;
      const { error: authErr } = await supabase.auth.updateUser({
        data: {
          ...prev,
          username: p.username,
          bio: p.bio,
          avatar_url: p.avatar_url,
          location: p.location,
          tagline: p.tagline,
        },
      });
      if (authErr) {
        dispatch({ type: "SET_ERROR", payload: authErr.message });
        return;
      }
      const normalizedEmail = (session.user.email ?? "").trim().toLowerCase();
      const profileRow = {
        id: session.user.id,
        username: p.username,
        bio: p.bio,
        avatar_url: p.avatar_url,
        updated_at: new Date().toISOString(),
        ...(normalizedEmail ? { email_normalized: normalizedEmail } : {}),
      };
      const { error: pe } = await supabase.from("profiles").upsert(profileRow, { onConflict: "id" });
      const s2 = await supabase.auth.getSession();
      const nextSession = (await getSessionForRefresh()) ?? s2.data.session;
      await refreshFromSession(nextSession);
      if (pe && !isMissingProfilesTableMessage(String(pe.message))) {
        if (pe.code === "23505" || String(pe.message).includes("unique")) {
          dispatch({ type: "SET_ERROR", payload: "That username is taken." });
        } else {
          dispatch({ type: "SET_ERROR", payload: pe.message });
        }
      }
    },
    [refreshFromSession],
  );

  const completeOnboarding = useCallback(
    async (p: {
      interests: string[];
      skills?: string[];
      role_tag?: string;
      stage?: string[];
      goals?: string[];
    }) => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const { data, error: getErr } = await supabase.auth.getUser();
        if (getErr || !data.user) throw getErr || new Error("Not signed in");
        const prev = (data.user.user_metadata ?? {}) as Record<string, unknown>;
        const { error } = await supabase.auth.updateUser({
          data: {
            ...prev,
            onboarding_complete: true,
            role_tag: p.role_tag ?? prev.role_tag ?? "",
            skills: p.skills ?? prev.skills ?? [],
            preferences: {
              interests: p.interests,
              stage: p.stage ?? [],
              goals: p.goals ?? [],
            },
          },
        });
        if (error) throw error;

        // Best-effort backend sync. The UI relies on Supabase metadata first,
        // so we don't block onboarding completion if the Go API is unreachable.
        try {
          const { profileApi } = await import("@/utils/profile.api");
          await profileApi.completeOnboarding({
            role_tag: p.role_tag ?? "",
            interests: p.interests,
            skills: p.skills ?? [],
          });
        } catch (syncErr) {
          if (__DEV__) console.warn("[onboarding] backend sync failed:", syncErr);
        }

        const s2 = await supabase.auth.getSession();
        const nextSession = (await getSessionForRefresh()) ?? s2.data.session;
        await refreshFromSession(nextSession);
      } catch (e: any) {
        dispatch({
          type: "SET_ERROR",
          payload: String(e?.message ?? "Could not save onboarding."),
        });
        throw e;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [refreshFromSession],
  );

  const logout = useCallback(async () => {
    await signOut();
    dispatch({ type: "LOGOUT" });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "SET_ERROR", payload: null });
  }, []);

  const updateUser = useCallback((user: UserDTO) => {
    dispatch({ type: "SET_FROM_SESSION", payload: { user, stage: "authed" } });
  }, []);

  const setSignupRole = useCallback((role: string | null) => {
    dispatch({ type: "SET_SIGNUP_ROLE", payload: role });
  }, []);

  /** Can use the main app (tabs): session and past email verification / guest gate. */
  const isAuthenticated =
    !!state.session &&
    (state.stage === "authed" || state.stage === "needs_profile");

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAuthenticated,
        login,
        register,
        signInWithGoogle: doGoogle,
        completeOnboarding,
        saveProfile,
        logout,
        clearError,
        updateUser,
        rehydrateSession,
        setSignupRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
