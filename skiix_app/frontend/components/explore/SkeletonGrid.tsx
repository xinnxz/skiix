import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View, Easing } from "react-native";

const TOKENS = {
  card: "#111111",
  shimmer: "rgba(255,255,255,0.06)",
};

const HEIGHTS = [260, 180, 220, 280, 200, 240];

type Props = {
  columnWidth: number;
};

export function SkeletonGrid({ columnWidth }: Props) {
  const cards = useMemo(
    () =>
      HEIGHTS.map((h, idx) => ({
        id: `sk-${idx}`,
        height: h,
        col: idx % 2,
      })),
    [],
  );
  const left = cards.filter((c) => c.col === 0);
  const right = cards.filter((c) => c.col === 1);
  return (
    <View style={styles.row}>
      <View style={[styles.col, { width: columnWidth }]}>
        {left.map((c) => (
          <ShimmerCard key={c.id} height={c.height} />
        ))}
      </View>
      <View style={[styles.col, { width: columnWidth }]}>
        {right.map((c) => (
          <ShimmerCard key={c.id} height={c.height} />
        ))}
      </View>
    </View>
  );
}

function ShimmerCard({ height }: { height: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.View style={[styles.card, { height, opacity }]}>
      <View style={styles.inner} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 10,
  },
  col: { flex: 1 },
  card: {
    width: "100%",
    backgroundColor: TOKENS.card,
    borderRadius: 20,
    marginBottom: 10,
    overflow: "hidden",
  },
  inner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: TOKENS.shimmer,
  },
});
