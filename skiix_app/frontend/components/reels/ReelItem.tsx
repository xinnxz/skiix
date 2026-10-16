import React, { useCallback, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import { VideoPlayer } from "./VideoPlayer";
import { ReelOverlay } from "./ReelOverlay";
import { useReelsStore } from "@/store/reelsStore";
import type { ReelView } from "@/services/reelsService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = {
  reel: ReelView;
  index: number;
  activeIndex: number;
  topInset: number;
  bottomInset: number;
  onLike: (reel: ReelView) => void;
  onSave: (reel: ReelView) => void;
  onFollow: (reel: ReelView) => void;
  onComment: (reel: ReelView) => void;
  onShare: (reel: ReelView) => void;
  onAvatarPress?: (reel: ReelView) => void;
  onJoinProject?: (reel: ReelView) => void;
  onHashtagPress?: (tag: string) => void;
};

const DOUBLE_TAP_MS = 280;

function ReelItemBase({
  reel,
  index,
  activeIndex,
  topInset,
  bottomInset,
  onLike,
  onSave,
  onFollow,
  onComment,
  onShare,
  onAvatarPress,
  onJoinProject,
  onHashtagPress,
}: Props) {
  const isMuted = useReelsStore((s) => s.isMuted);
  const toggleMute = useReelsStore((s) => s.toggleMute);

  const isActive = index === activeIndex;
  const isPreloaded = Math.abs(index - activeIndex) <= 1;

  const lastTapRef = useRef<number>(0);
  const muteIconOpacity = useRef(new Animated.Value(0)).current;
  const heartBurstOpacity = useRef(new Animated.Value(0)).current;
  const heartBurstScale = useRef(new Animated.Value(0.6)).current;
  const [showHeart, setShowHeart] = useState(false);

  const blinkMuteIcon = useCallback(() => {
    muteIconOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(muteIconOpacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(280),
      Animated.timing(muteIconOpacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [muteIconOpacity]);

  const flashHeart = useCallback(() => {
    setShowHeart(true);
    heartBurstOpacity.setValue(0);
    heartBurstScale.setValue(0.6);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(heartBurstOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.delay(420),
        Animated.timing(heartBurstOpacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(heartBurstScale, {
        toValue: 1.1,
        useNativeDriver: true,
        damping: 7,
      }),
    ]).start(() => setShowHeart(false));
  }, [heartBurstOpacity, heartBurstScale]);

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      if (!reel.is_liked) onLike(reel);
      flashHeart();
      return;
    }
    lastTapRef.current = now;
    // Single tap → toggle mute after the double-tap window passes.
    setTimeout(() => {
      if (Date.now() - lastTapRef.current >= DOUBLE_TAP_MS) {
        toggleMute();
        blinkMuteIcon();
      }
    }, DOUBLE_TAP_MS + 10);
  }, [reel, onLike, flashHeart, toggleMute, blinkMuteIcon]);

  return (
    <View style={styles.container}>
      <VideoPlayer
        uri={reel.video_url}
        thumbnailUri={reel.thumbnail_url}
        isActive={isActive}
        isPreloaded={isPreloaded}
        isMuted={isMuted}
      />

      {/* Tap surface for mute / double-tap like — sits under overlay UI. */}
      <Pressable
        onPress={handlePress}
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Tap to mute, double-tap to like"
      />

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
        locations={[0.3, 0.6, 1]}
        style={[styles.gradient, { height: SCREEN_HEIGHT * 0.55 }]}
        pointerEvents="none"
      />

      {showHeart ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.heartBurst,
            {
              opacity: heartBurstOpacity,
              transform: [{ scale: heartBurstScale }],
            },
          ]}
        >
          <FontAwesome name="heart" size={120} color="#FFFFFF" />
        </Animated.View>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[styles.muteIcon, { opacity: muteIconOpacity }]}
      >
        <Ionicons
          name={isMuted ? "volume-mute" : "volume-high"}
          size={48}
          color="#FFFFFF"
        />
      </Animated.View>

      {isPreloaded ? (
        <ReelOverlay
          reel={reel}
          bottomInset={bottomInset + 12}
          onLike={() => onLike(reel)}
          onSave={() => onSave(reel)}
          onFollow={() => onFollow(reel)}
          onComment={() => onComment(reel)}
          onShare={() => onShare(reel)}
          onAvatarPress={
            onAvatarPress ? () => onAvatarPress(reel) : undefined
          }
          onJoinProject={
            reel.project_id ? () => onJoinProject?.(reel) : undefined
          }
          onHashtagPress={onHashtagPress}
        />
      ) : null}

      {/* Reserve space for header so the gradient/text never sits behind it. */}
      <View pointerEvents="none" style={{ height: topInset }} />
    </View>
  );
}

export const ReelItem = React.memo(ReelItemBase, (prev, next) => {
  return (
    prev.reel === next.reel &&
    prev.index === next.index &&
    prev.activeIndex === next.activeIndex &&
    prev.topInset === next.topInset &&
    prev.bottomInset === next.bottomInset
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: SCREEN_HEIGHT,
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  heartBurst: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  muteIcon: {
    position: "absolute",
    top: "45%",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
