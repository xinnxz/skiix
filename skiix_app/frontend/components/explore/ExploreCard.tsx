import React, { useMemo } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { ExploreCard as ExploreCardType } from "@/services/exploreService";
import { optimizeImageUrl } from "@/utils/cloudinary";

type Props = {
  card: ExploreCardType;
  width: number;
  onPress?: (card: ExploreCardType) => void;
};

export function ExploreCard({ card, width, onPress }: Props) {
  const optimizedUri = useMemo(
    () => optimizeImageUrl(card.image_url, width),
    [card.image_url, width],
  );

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(card)}
      style={[styles.card, { width, height: card.height }]}
      accessibilityRole="button"
      accessibilityLabel={card.title}
    >
      <Image
        source={{ uri: optimizedUri }}
        style={styles.image}
        contentFit="cover"
        transition={250}
        cachePolicy="memory-disk"
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.gradient}
        pointerEvents="none"
      />
      <View style={styles.pill}>
        <Text style={styles.label} numberOfLines={1}>
          {card.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 10,
    backgroundColor: "#111111",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  pill: {
    position: "absolute",
    left: 12,
    bottom: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  label: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
