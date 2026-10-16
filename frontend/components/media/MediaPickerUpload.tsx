import React, { useMemo, useState } from "react";
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { mediaApi } from "@/utils/media.api";
import { Colors } from "@/theme";

type Props = {
  onUploaded: (p: { url: string; resourceType: "image" | "video" | "raw" }) => void;
};

function guessMime(uri: string, fallback: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return fallback || "application/octet-stream";
}

export function MediaPickerUpload({ onUploaded }: Props) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("image/jpeg");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVideo = useMemo(() => mime.startsWith("video/"), [mime]);

  const pick = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Permission denied to access media library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: !isVideo,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const chosenMime = guessMime(asset.uri, asset.mimeType ?? "application/octet-stream");
    setLocalUri(asset.uri);
    setMime(chosenMime);
  };

  const upload = async () => {
    if (!localUri) return;
    setUploading(true);
    setError(null);
    try {
      const name = localUri.split("/").pop() || (isVideo ? "video.mp4" : "image.jpg");
      const res = await mediaApi.upload({ uri: localUri, name, type: mime });
      onUploaded({ url: res.url, resourceType: res.resource_type });
    } catch (e: any) {
      setError(e?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        padding: 12,
        gap: 10,
      }}
    >
      <TouchableOpacity
        onPress={pick}
        activeOpacity={0.85}
        style={{
          height: 160,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: "#0D1216",
        }}
      >
        {localUri && !isVideo ? (
          <Image source={{ uri: localUri }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <View style={{ alignItems: "center", gap: 6 }}>
            <Ionicons name={localUri ? "videocam" : "cloud-upload-outline"} size={26} color={Colors.primary} />
            <Text style={{ color: Colors.textSecondary }}>
              {localUri ? "Video selected" : "Pick image or video"}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {error ? <Text style={{ color: Colors.destructive }}>{error}</Text> : null}

      <TouchableOpacity
        onPress={upload}
        disabled={!localUri || uploading}
        style={{
          height: 46,
          borderRadius: 14,
          backgroundColor: !localUri || uploading ? "rgba(112,218,255,0.25)" : Colors.primary,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        }}
      >
        {uploading ? <ActivityIndicator color={Colors.bgBlack} /> : <Ionicons name="arrow-up" size={18} color={Colors.bgBlack} />}
        <Text style={{ color: Colors.bgBlack, fontWeight: "800" }}>
          {uploading ? "Uploading…" : "Upload"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

