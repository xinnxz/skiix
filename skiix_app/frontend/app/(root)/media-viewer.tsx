import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function MediaViewerScreen() {
  const { uri, type, username, caption } = useLocalSearchParams<{
    uri?: string;
    type?: string;
    username?: string;
    caption?: string;
  }>();

  const mediaUri = typeof uri === "string" ? decodeURIComponent(uri) : "";
  const mediaType = type === "video" ? "video" : "image";
  const cap = typeof caption === "string" ? decodeURIComponent(caption) : "";
  const user = typeof username === "string" ? decodeURIComponent(username) : "";

  return (
    <View style={styles.fill}>
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.uname} numberOfLines={1}>
          @{user || "skiix"}
        </Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {mediaType === "image" ? (
        <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFillObject} contentFit="contain" />
      ) : (
        <Video
          source={{ uri: mediaUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          useNativeControls
          isLooping
        />
      )}

      {cap ? (
        <SafeAreaView edges={["bottom"]} style={styles.captionBar}>
          <Text style={styles.caption}>{cap}</Text>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 8,
  },
  closeBtn: { padding: 8 },
  uname: { flex: 1, color: "#FFF", fontWeight: "600" },
  captionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  caption: { color: "#FFF", fontSize: 14, lineHeight: 20 },
});
