import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  useRef,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { UserDTO } from "@/types/user.types";
import { mapProfileToUserDTO } from "@/utils/userProfileMapper";
import { supabase } from "@/lib/supabase";
import {
  loadProfileForUser,
  isMissingProfilesTableMessage,
  getSessionForRefresh,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
} from "@/services/supabaseAuthService";

type Stage = "boot" | "guest" | "needs_profile" | "needs_onboarding" | "authed";

interface AuthState {
  user: UserDTO | null;
  session: Session | null;
  authUser: User | null;
  stage: Stage;
  isLoading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_FROM_SESSION"; payload: Partial<AuthState> }
  | { type: "SET_ERROR"; payload: string | null }
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
    case "LOGOUT":
      return {
        user: null,
        session: null,
        authUser: null,
        stage: "guest",
        isLoading: false,
        error: null,
      };
    default:
      return state;
  }
}

function computeStage(session: Session | null, hasProfile: boolean): Stage {
  if (!session) return "guest";
  if (!hasProfile) return "needs_profile";
  // Profile exists, but may still need personalization/onboarding.
  const m = session.user.user_metadata as Record<string, unknown> | null | undefined;
  const onboardingComplete = m?.onboarding_complete === true;
  if (!onboardingComplete) return "needs_onboarding";
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
  /** Existing users: email + password (no OTP). */
  login: (p: { email: string; password: string }) => Promise<void>;
  /** New users: sign up with email + password (no OTP). */
  register: (p: RegisterPayload) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  completeOnboarding: (p: {
    interests: string[];
    stage: string[];
    goals: string[];
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
    stage: "needs_profile" as const,
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      await refreshFromSession(data.session ?? null);
      bootstrapped.current = true;
    })();
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
        if (error) throw error;
        await refreshFromSession(data.session);
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
      }
    },
    [refreshFromSession],
  );

  const register = useCallback(
    async (data: RegisterPayload) => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const { data: res, error } = await signUpWithEmail(
          data.email,
          data.password,
          {
            username: data.username,
            display_name: data.display_name,
            role: data.role,
            first_name: data.first_name,
            last_name: data.last_name,
          },
        );
        if (error) throw error;
        // With "Confirm email" disabled in Supabase, signUp returns a session.
        if (!res.session) {
          throw new Error(
            "Signup requires email confirmation in Supabase. Disable 'Confirm email' in Authentication settings to sign up without OTP.",
          );
        }
        await refreshFromSession(res.session);
      } catch (e: any) {
        const m = String(e?.message ?? "");
        const msg =
          m.includes("User already registered") || m.includes("already been registered")
            ? "This email is already registered. Sign in instead."
            : m || "Sign up failed.";
        dispatch({ type: "SET_ERROR", payload: msg });
        dispatch({ type: "SET_LOADING", payload: false });
        throw e;
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
    async (p: { interests: string[]; stage: string[]; goals: string[] }) => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const { data, error: getErr } = await supabase.auth.getUser();
        if (getErr || !data.user) throw getErr || new Error("Not signed in");
        const prev = (data.user.user_metadata ?? {}) as Record<string, unknown>;
        const { error } = await supabase.auth.updateUser({
          data: {
            ...prev,
            onboarding_complete: true,
            preferences: {
              interests: p.interests,
              stage: p.stage,
              goals: p.goals,
            },
          },
        });
        if (error) throw error;
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
