import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/store/auth.store";
import { Colors } from "@/theme";

export default function Index() {
  const { isLoading, stage } = useAuth();

  // While auth is resolving, avoid sending users to /welcome (login success was racing here).
  if (isLoading) {
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

  if (stage === "guest" || stage === "boot") {
    return <Redirect href="/auth/welcome" />;
  }
  if (stage === "needs_profile") {
    return <Redirect href="/auth/profile-setup" />;
  }
  if (stage === "needs_onboarding") {
    return <Redirect href="/personalize" />;
  }
  return <Redirect href="/(root)/(tabs)" />;
}
