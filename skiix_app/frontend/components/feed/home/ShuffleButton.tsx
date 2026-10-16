import React, { useCallback } from "react";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

type Props = {
  loading?: boolean;
  onPress: () => void;
};

export function ShuffleButton({ loading, onPress }: Props) {
  const rot = useSharedValue(0);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rot.value = withSequence(
      withTiming(180, { duration: 220 }),
      withTiming(360, { duration: 220 }),
    );
    rot.value = 0;
    onPress();
  }, [onPress, rot]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.85}
      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#00E5FF44] bg-[#0A1A20]"
    >
      {loading ? (
        <ActivityIndicator size="small" color="#00E5FF" />
      ) : (
        <Animated.View style={spinStyle}>
          <Ionicons name="shuffle" size={18} color="#00E5FF" />
        </Animated.View>
      )}
      <Text className="text-[#00E5FF] font-spaceBold text-xs">Shuffle</Text>
    </TouchableOpacity>
  );
}
