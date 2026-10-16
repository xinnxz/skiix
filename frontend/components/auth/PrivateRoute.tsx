import React from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/store/auth.store";
import { Colors } from "@/theme";

type Props = {
  children: React.ReactNode;
  redirectTo?: string;
};

/**
 * Simple protected-route wrapper for Expo Router screens/layouts.
 * Prefer guarding at the layout level, but this works for any subtree.
 */
export function PrivateRoute({ children, redirectTo = "/auth/welcome" }: Props) {
  const { isLoading, stage, isAuthenticated, session } = useAuth();

  if (isLoading && stage === "boot") {
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

  if (!session || !isAuthenticated) {
    return <Redirect href={redirectTo as any} />;
  }

  return <>{children}</>;
}

