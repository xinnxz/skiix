// ============================================================
// WELCOME SCREEN
// ============================================================

import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions, Image } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { Colors, Typography, BorderRadius, Spacing } from "@/theme";
import { Button } from "@/components/common";
import images from "@/constants/images";

const { width: W, height: H } = Dimensions.get("window");

export default function WelcomeScreen() {
  const router = useRouter();

  const logoOpacity = useSharedValue(0);
  const logoY = useSharedValue(20);
  const taglineOpacity = useSharedValue(0);
  const btnsOpacity = useSharedValue(0);
  const btnsY = useSharedValue(30);

  useEffect(() => {
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 700 }));
    logoY.value = withDelay(200, withSpring(0, { damping: 14 }));
    taglineOpacity.value = withDelay(600, withTiming(1, { duration: 700 }));
    btnsOpacity.value = withDelay(900, withTiming(1, { duration: 600 }));
    btnsY.value = withDelay(900, withSpring(0, { damping: 14 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));
  const btnsStyle = useAnimatedStyle(() => ({
    opacity: btnsOpacity.value,
    transform: [{ translateY: btnsY.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Background glow orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {/* Grid lines decoration */}
      <View style={styles.gridOverlay} pointerEvents="none" />

      <LinearGradient
        colors={["transparent", "rgba(112,218,255,0.04)", "transparent"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Logo + Brand */}
      <Animated.View style={[styles.logoSection, logoStyle]}>
        <View style={styles.logoIcon}>
          <Image
            source={images.logo}
            className="h-[70px] w-[60px]"
            resizeMode="contain"
          />
          {/*<Ionicons name="planet-outline" size={42} color={Colors.primary} />*/}
        </View>
        <Text style={styles.brandName}>Skiix</Text>
        <View style={styles.taglinePill}>
          <View style={styles.taglineDot} />
          <Text style={styles.taglinePillText}>
            For Builders · Founders · Creators
          </Text>
        </View>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[styles.taglineSection, taglineStyle]}>
        <Text style={styles.headline}>
          Where <Text style={{ color: Colors.primary }}>ideas meet</Text>
          {"\n"}people who build them.
        </Text>
        <Text style={styles.subheadline}>
          Discover opportunities, collaborate with creators, and grow through a
          community that actually builds.
        </Text>

        {/* Feature pills */}
        <View style={styles.featureRow}>
          {[
            { icon: "bulb-outline", label: "Ideas" },
            { icon: "people-outline", label: "Collaborate" },
            { icon: "rocket-outline", label: "Launch" },
          ].map((f) => (
            <View key={f.label} style={styles.featurePill}>
              <Ionicons name={f.icon as any} size={14} color={Colors.primary} />
              <Text style={styles.featurePillText}>{f.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* CTA Buttons */}
      <Animated.View style={[styles.btnSection, btnsStyle]}>
        <Button
          label="Get Started"
          onPress={() => router.push("/auth/register")}
          variant="primary"
          size="lg"
          rightIcon="arrow-forward"
          style={{ width: "100%" }}
        />
        <Button
          label="I already have an account"
          onPress={() => router.push("/auth/login")}
          variant="secondary"
          size="lg"
          style={{ width: "100%" }}
        />
        <Text style={styles.legalText}>
          By continuing you agree to our{" "}
          <Text style={{ color: Colors.primary }}>Terms</Text> &{" "}
          <Text style={{ color: Colors.primary }}>Privacy Policy</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBlack,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
    justifyContent: "space-between",
  },
  orb1: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(112,218,255,0.06)",
    top: -60,
    right: -80,
  },
  orb2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(112,218,255,0.04)",
    bottom: 100,
    left: -60,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
  },
  logoSection: {
    alignItems: "center",
    marginTop: 20,
  },
  logoIcon: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowRadius: 20,
    elevation: 10,
  },
  brandName: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  taglinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  taglineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  taglinePillText: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  taglineSection: { gap: 16 },
  headline: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  subheadline: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  featureRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  featurePillText: {
    color: Colors.primary,
    fontSize: Typography.xs,
    fontWeight: "600",
  },
  btnSection: { gap: 12 },
  legalText: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    textAlign: "center",
    marginTop: 4,
  },
});
