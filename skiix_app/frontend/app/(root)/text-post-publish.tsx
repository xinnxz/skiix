import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/store/auth.store";
import { supabase } from "@/lib/supabase";
import { mediaApi } from "@/utils/media.api";
import { createAuthenticatedPost } from "@/utils/posts.api";
import { getApiErrorMessage } from "@/utils/getApiErrorMessage";
import { refreshAfterPostCreate } from "@/utils/postCreation";

const ACCENT = "#00E5FF";

function guessImageMime(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

function stripTagsForApi(tags: string[]) {
  return tags
    .map((t) => t.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
}

function buildPollFooter(opts: string[]) {
  const valid = opts.map((o) => o.trim()).filter(Boolean);
  if (valid.length < 2) return "";
  return `\n\n📊 Poll\n${valid.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n`;
}

export default function TextPostPublishScreen() {
  const params = useLocalSearchParams<{
    content: string;
    images: string;
    tags: string;
    location: string;
    fontStyleId?: string;
    hasPoll: string;
    pollOptions: string;
  }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [audience, setAudience] = useState<"everyone" | "followers">("everyone");
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const images: string[] = useMemo(() => {
    try {
      return JSON.parse(params.images ?? "[]") as string[];
    } catch {
      return [];
    }
  }, [params.images]);

  const tags: string[] = useMemo(() => {
    try {
      return JSON.parse(params.tags ?? "[]") as string[];
    } catch {
      return [];
    }
  }, [params.tags]);

  const pollOptions: string[] = useMemo(() => {
    try {
      return JSON.parse(params.pollOptions ?? "[]") as string[];
    } catch {
      return [];
    }
  }, [params.pollOptions]);

  const hasPoll = params.hasPoll === "true";

  const bodyText = params.content ?? "";
  const mergedContent =
    `${bodyText.trim()}${hasPoll ? buildPollFooter(pollOptions) : ""}`.trim();
  const loc = typeof params.location === "string" ? params.location.trim() : "";

  const handleAudience = () => {
    Alert.alert("Audience", "Who can see this post?", [
      { text: "Everyone", onPress: () => setAudience("everyone") },
      { text: "Followers only", onPress: () => setAudience("followers") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const uploadImages = async (uris: string[]): Promise<{ urls: string[] }> => {
    const urls: string[] = [];
    for (let i = 0; i < uris.length; i++) {
      const uri = uris[i]!;
      const name = uri.split("/").pop() || `photo_${Date.now()}_${i}.jpg`;
      const type = guessImageMime(uri);
      const up = await mediaApi.upload({ uri, name, type }, (pct) => {
        setUploadProgress(Math.round((i / Math.max(uris.length, 1)) * 55 + (pct / 100) * (55 / uris.length)));
      });
      urls.push(up.url);
      setUploadProgress(Math.round(((i + 1) / Math.max(uris.length, 1)) * 55));
    }
    return { urls };
  };

  const handlePost = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      Alert.alert("Sign in required", "You need an account to publish.");
      return;
    }

    setPosting(true);
    setUploadProgress(6);

    try {
      let primary: string | null = null;
      let extraUrls: string[] = [];

      if (images.length > 0) {
        const { urls } = await uploadImages(images);
        primary = urls[0] ?? null;
        extraUrls = urls.slice(1).filter(Boolean);
        setUploadProgress(62);
      } else {
        setUploadProgress(60);
      }

      const payloadContent = mergedContent.trim();
      const created = await createAuthenticatedPost({
        type: "text",
        content: payloadContent,
        visibility: "public",
        media_url: primary,
        image_url: primary,
        tags: stripTagsForApi(tags),
        location: loc || null,
        audience,
        share_to_feed: true,
        share_to_profile: true,
        ...(extraUrls.length ? { extra_media_urls: extraUrls } : {}),
      });

      setUploadProgress(100);
      await refreshAfterPostCreate(queryClient, user?.email ?? "", {
        createdPost: created,
        username: user?.username,
      });

      Alert.alert("Posted!", "Your post is on the Skiix feed.", [
        {
          text: "View Feed",
          onPress: () => router.replace("/"),
        },
      ]);
    } catch (e: unknown) {
      Alert.alert("Post failed", getApiErrorMessage(e));
    } finally {
      setPosting(false);
      setUploadProgress(0);
    }
  };

  const previewHandle = user?.username?.trim() || user?.email?.split("@")[0] || "you";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} disabled={posting} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share post</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.preview}>
        <View style={styles.previewAuthor}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{previewHandle.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text style={styles.previewUsername}>@{previewHandle}</Text>
            <Text style={styles.previewAudience}>
              {audience === "everyone" ? "🌍 Everyone" : "👥 Followers only"}
            </Text>
          </View>
        </View>

        <Text style={styles.previewContent} numberOfLines={hasPoll ? 8 : 6}>
          {bodyText.trim() ? bodyText.trim() : images.length ? " " : "—"}
        </Text>

        {tags.length > 0 ? <Text style={styles.previewTags}>{tags.join(" ")}</Text> : null}

        {loc ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Ionicons name="location-outline" size={14} color={ACCENT} />
            <Text style={{ color: ACCENT, fontSize: 13 }}>{loc}</Text>
          </View>
        ) : null}

        {images.length > 0 ? (
          <Text style={styles.previewImages}>
            📷 {images.length} image{images.length > 1 ? "s" : ""} attached
          </Text>
        ) : null}

        {hasPoll && pollOptions.filter((o) => o.trim()).length >= 2 ? (
          <View style={styles.pollPreview}>
            <Text style={styles.pollPreviewTitle}>📊 Poll</Text>
            {pollOptions
              .map((o) => o.trim())
              .filter(Boolean)
              .map((opt, i) => (
                <View key={`${opt}-${i}`} style={styles.pollPreviewOption}>
                  <Text style={styles.pollPreviewOptionText}>{opt}</Text>
                </View>
              ))}
          </View>
        ) : null}
      </View>

      <TouchableOpacity style={styles.audienceRow} onPress={handleAudience}>
        <Text style={styles.audienceLabel}>Audience</Text>
        <View style={styles.audienceBtn}>
          <Text style={styles.audienceBtnText}>{audience === "everyone" ? "Everyone" : "Followers"}</Text>
          <Ionicons name="chevron-down" size={16} color="#888888" />
        </View>
      </TouchableOpacity>

      {posting ? (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {uploadProgress < 60 ? "Uploading media…" : "Publishing…"} {uploadProgress}%
          </Text>
        </View>
      ) : null}

      <View style={styles.postBtnContainer}>
        <TouchableOpacity style={[styles.postBtn, posting && styles.postBtnDisabled]} onPress={() => void handlePost()} disabled={posting}>
          {posting ? (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#000000" />
              <Text style={styles.postBtnText}>Posting…</Text>
            </View>
          ) : (
            <Text style={styles.postBtnText}>Post now</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  preview: {
    margin: 16,
    padding: 16,
    backgroundColor: "#111111",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  previewAuthor: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 999 },
  avatarFallback: { backgroundColor: "#1A3A4A", alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: ACCENT, fontSize: 14, fontWeight: "700" },
  previewUsername: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  previewAudience: { fontSize: 12, color: "#888888", marginTop: 2 },
  previewContent: { fontSize: 15, color: "#FFFFFF", lineHeight: 22, marginBottom: 8 },
  previewTags: { fontSize: 14, color: ACCENT, marginBottom: 6 },
  previewImages: { fontSize: 13, color: "#888888" },
  pollPreview: { marginTop: 10 },
  pollPreviewTitle: { color: ACCENT, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  pollPreviewOption: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  pollPreviewOptionText: { color: "#FFFFFF", fontSize: 14 },
  audienceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    backgroundColor: "#111111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F1F1F",
    marginBottom: 8,
  },
  audienceLabel: { fontSize: 15, color: "#FFFFFF", fontWeight: "600" },
  audienceBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  audienceBtnText: { fontSize: 14, color: "#888888" },
  progressContainer: { paddingHorizontal: 16, paddingVertical: 10 },
  progressTrack: {
    height: 3,
    backgroundColor: "#1F1F1F",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: { height: 3, backgroundColor: ACCENT, borderRadius: 2 },
  progressText: { color: "#888888", fontSize: 12, textAlign: "center" },
  postBtnContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
  },
  postBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  postBtnDisabled: { opacity: 0.65 },
  postBtnText: { fontSize: 17, fontWeight: "800", color: "#000000" },
});
