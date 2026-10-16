import { Stack } from "expo-router";
import { View } from "react-native";

export default function AuthGroupLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: "#000" },
        }}
      />
    </View>
  );
}
