import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import { Image } from "expo-image";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

type Props = {
  uri: string;
  thumbnailUri: string;
  isActive: boolean;
  /** True when within ±1 of the active reel — render the Video but stay paused. */
  isPreloaded: boolean;
  isMuted: boolean;
  onPlaybackError?: (msg: string) => void;
};

/**
 * Full-screen vertical video. Only renders the underlying <Video> when the reel
 * is active or one of the two adjacent reels (preload window). Other reels show
 * just the thumbnail to keep memory at ~3 videos max.
 */
export function VideoPlayer({
  uri,
  thumbnailUri,
  isActive,
  isPreloaded,
  isMuted,
  onPlaybackError,
}: Props) {
  const videoRef = useRef<Video>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.playAsync().catch(() => {});
    } else {
      v.pauseAsync().catch(() => {});
      // Seek back so the reel restarts cleanly next time the user lands here.
      v.setPositionAsync(0).catch(() => {});
    }
  }, [isActive]);

  useEffect(() => {
    videoRef.current?.setIsMutedAsync(isMuted).catch(() => {});
  }, [isMuted]);

  useEffect(() => {
    if (!isPreloaded) setIsReady(false);
  }, [isPreloaded]);

  const handleStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        if (status.error) onPlaybackError?.(status.error);
        return;
      }
      if (status.isLoaded && !isReady) setIsReady(true);
    },
    [isReady, onPlaybackError],
  );

  const videoStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isReady ? 1 : 0, { duration: 220 }),
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: thumbnailUri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
      />

      {isActive || isPreloaded ? (
        <Animated.View style={[StyleSheet.absoluteFill, videoStyle]}>
          <Video
            ref={videoRef}
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            isLooping
            isMuted={isMuted}
            shouldPlay={isActive}
            useNativeControls={false}
            progressUpdateIntervalMillis={500}
            onPlaybackStatusUpdate={handleStatus}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
