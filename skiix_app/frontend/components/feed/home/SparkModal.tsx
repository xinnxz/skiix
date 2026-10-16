import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SparkCard, SparkChoices } from "@/utils/mvpFeatures.api";

const CYAN = "#00E5FF";

type Props = {
  visible: boolean;
  loading: boolean;
  choices: SparkChoices | null;
  onClose: () => void;
  onSelect: (card: SparkCard) => void;
};

const CARD_META: Record<
  SparkCard["category"],
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  learn: { label: "Learn", icon: "school-outline", color: "#22C55E" },
  startup: { label: "Startup", icon: "rocket-outline", color: CYAN },
  wildcard: { label: "Wildcard", icon: "sparkles-outline", color: "#F59E0B" },
};

function SparkCardView({
  card,
  index,
  onSelect,
}: {
  card: SparkCard | null;
  index: number;
  onSelect: (c: SparkCard) => void;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  if (!card?.post_id) {
    return (
      <View className="flex-1 min-h-[160px] rounded-2xl border border-[#FFFFFF15] bg-[#111] items-center justify-center p-4">
        <Text className="text-[#666] font-space text-xs text-center">No match right now</Text>
      </View>
    );
  }
  const meta = CARD_META[card.category];
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()} style={anim} className="flex-1">
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.96);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        onPress={() => onSelect(card)}
        className="rounded-2xl overflow-hidden border border-[#FFFFFF22] bg-[#0D1117] min-h-[200px]"
      >
        <Image
          source={{ uri: card.thumbnail }}
          style={{ width: "100%", height: 110 }}
          contentFit="cover"
        />
        <View className="p-3">
          <View className="flex-row items-center gap-1.5 mb-1">
            <Ionicons name={meta.icon} size={14} color={meta.color} />
            <Text style={{ color: meta.color }} className="font-spaceBold text-xs">
              {meta.label}
            </Text>
          </View>
          <Text className="text-white font-spaceBold text-sm" numberOfLines={2}>
            {card.title}
          </Text>
          <Text className="text-[#888] font-space text-xs mt-1">@{card.creator}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function SparkModal({ visible, loading, choices, onClose, onSelect }: Props) {
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  useEffect(() => {
    if (visible) setOpenedAt(Date.now());
    else setOpenedAt(null);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/80" onPress={onClose}>
        <SafeAreaView className="flex-1 justify-end" edges={["bottom"]}>
          <Pressable
            className="bg-[#0A0F12] rounded-t-[28px] border-t border-[#FFFFFF22] px-5 pt-4 pb-8"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="w-10 h-1 rounded-full bg-[#333] self-center mb-4" />
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-white font-spaceBold text-xl">Choose Your Spark</Text>
                <Text className="text-[#888] font-space text-xs mt-1">
                  Pick what you want to explore — no autoplay
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View className="py-16 items-center">
                <ActivityIndicator color={CYAN} />
              </View>
            ) : (
              <View className="flex-row gap-3">
                <SparkCardView
                  card={choices?.learn ?? null}
                  index={0}
                  onSelect={onSelect}
                />
                <SparkCardView
                  card={choices?.startup ?? null}
                  index={1}
                  onSelect={onSelect}
                />
                <SparkCardView
                  card={choices?.wildcard ?? null}
                  index={2}
                  onSelect={onSelect}
                />
              </View>
            )}

            {openedAt ? (
              <Text className="text-[#444] font-space text-[10px] text-center mt-4">
                Session started {new Date(openedAt).toLocaleTimeString()}
              </Text>
            ) : null}
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
