import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image as RNImage,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const CYAN = "#00E5FF";
const CARD_HORIZONTAL_INSET = 24 * 2; // mx-6 padding

type Props = {
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl?: string | null;
  onPress?: () => void;
};

export function HomePostMedia({ mediaUrl, mediaType, thumbnailUrl, onPress }: Props) {
  const screenW = Dimensions.get("window").width;
  const containerW = useMemo(
    () => Math.max(200, screenW - CARD_HORIZONTAL_INSET),
    [screenW],
  );
  const [dims, setDims] = useState({ w: 1, h: 1 });

  useEffect(() => {
    if (mediaType !== "image") return;
    let cancelled = false;
    RNImage.getSize(
      mediaUrl,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setDims({ w, h });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [mediaUrl, mediaType]);

  const isPortrait = dims.h > dims.w;
  const displayHeight =
    mediaType === "video"
      ? containerW * (9 / 16)
      : isPortrait
        ? Math.min(400, (containerW * dims.h) / Math.max(dims.w, 1))
        : containerW * (9 / 16);

  const thumb = thumbnailUrl || mediaUrl;

  const inner = (
    <>
      {mediaType === "image" ? (
        <Image
          source={{ uri: mediaUrl }}
          style={styles.media}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <>
          <Image source={{ uri: thumb }} style={styles.media} contentFit="cover" transition={200} />
          <View style={styles.playOuter}>
            <View style={styles.playInner}>
              <Ionicons name="play" size={22} color="#000000" />
            </View>
          </View>
        </>
      )}
    </>
  );

  const wrapStyle = [styles.wrap, { height: displayHeight }];
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={wrapStyle}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={wrapStyle}>{inner}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 12,
    backgroundColor: "#1A1A1A",
    width: "100%",
  },
  media: { width: "100%", height: "100%" },
  playOuter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  playInner: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(0, 229, 255, 0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(0, 229, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
});
