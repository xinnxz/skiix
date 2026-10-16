import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  LoginRequest,
  RegisterRequest,
  ProfileResponse,
  authService,
} from "@/services/auth";
import { getAccesToken } from "@/utils/axiosInstance";

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [isInitialized, setIsInitialized] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  // Init: check SecureStore
  useEffect(() => {
    const init = async () => {
      try {
        const token = await getAccesToken();
        setHasToken(!!token);
      } catch (e) {
        console.error("Auth init error:", e);
      } finally {
        setIsInitialized(true);
      }
    };

    init();
  }, []);

  // Profile query (source of truth)
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery<ProfileResponse>({
    queryKey: ["profile"],
    queryFn: authService.getProfile,
    enabled: isInitialized && hasToken,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // LOGIN
  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => authService.login(data),
    onSuccess: async () => {
      setHasToken(true);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      router.replace("/(root)/(tabs)");
    },
    onError: (error: Error) => {
      console.error("Login error:", error.message);
    },
  });

  //  GOOGLE LOGIN (IMPORTANT: expects id_token flow)
  // const googleLoginMutation = useMutation({
  //   mutationFn: (idToken: string) => authService.googleLogin(idToken), // ⚠️ FIX THIS IN SERVICE
  //   onSuccess: async () => {
  //     setHasToken(true);
  //     await queryClient.invalidateQueries({ queryKey: ["profile"] });
  //     router.replace("/(root)/(tabs)");
  //   },
  //   onError: (error: Error) => {
  //     console.error("Google login error:", error.message);
  //   },
  // });

  // REGISTER
  const registerMutation = useMutation({
    mutationFn: (data: RegisterRequest) => authService.register(data),
    onSuccess: async () => {
      setHasToken(true);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      router.replace("/(root)/(tabs)");
    },
    onError: (error: Error) => {
      console.error("Register error:", error.message);
    },
  });

  // LOGOUT
  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSuccess: async () => {
      setHasToken(false);
      queryClient.clear();
      router.replace("/auth/welcome");
    },
  });

  return {
    user,
    isLoadingUser: !isInitialized || (hasToken && isLoading),
    userError: error,
    refetchUser: refetch,

    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,

    // googleLogin: googleLoginMutation.mutate,
    // isGoogleLoading: googleLoginMutation.isPending,

    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,

    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,

    isAuthenticated: !!user,
    isInitialized,
  };
}
