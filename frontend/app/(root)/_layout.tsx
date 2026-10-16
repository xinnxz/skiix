import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/store/auth.store";
import { Colors } from "@/theme";

/**
 * (root) group — contains the authenticated app. Guard here to prevent any screen
 * (including tabs) from rendering while logged out or booting.
 */
export default function AppLayout() {
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
    return <Redirect href="/auth/welcome" />;
  }

  return <Slot />;
}
