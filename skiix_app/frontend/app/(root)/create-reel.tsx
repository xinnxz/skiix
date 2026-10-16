import React, { type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { Colors } from "@/theme";
import { supabase } from "@/lib/supabase";
import { mediaApi } from "@/utils/media.api";
import { createAuthenticatedPost } from "@/utils/posts.api";
import { getApiErrorMessage } from "@/utils/getApiErrorMessage";
import { refreshAfterPostCreate } from "@/utils/postCreation";
import { useAuth } from "@/store/auth.store";
import {
  deleteReelDraft,
  getReelDraft,
  saveReelDraft,
  type ReelDraftStep,
} from "@/utils/reelDrafts.storage";

type FlowStep = "select" | "edit" | "details" | "posting";

type Picked = { uri: string; mime: string; assetId?: string };

function guessMime(uri: string, fallback: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  return fallback || "video/mp4";
}

function isVideoMime(mime: string) {
  return mime.startsWith("video/");
}

const ACCENT = "#00E5FF";
const MUTED = "#8E8E93";

const EDIT_REEL_TOOLS = [
  { label: "Audio" },
  { label: "Text" },
  { label: "Emoji" },
  { label: "Filters" },
  { label: "Brightness" },
  { label: "Effects" },
] as const;

const POPULAR_EMOJIS = [
  "🔥", "💯", "🚀", "⚡", "💪", "🎯", "✨", "🙌",
  "❤️", "😊", "🎉", "🌟", "💡", "🏆", "👏", "🤝",
  "💻", "📱", "🎤", "📈", "🌍", "⭐", "🎨", "💰",
];

const TEXT_COLORS = ["#FFFFFF", "#000000", "#FF4D4D", "#00E5FF", "#FFD700", "#22C55E"];

const FILTERS: { id: string; label: string; tint: string | null }[] = [
  { id: "normal", label: "Normal", tint: null },
  { id: "clarendon", label: "Clarendon", tint: "rgba(127,187,227,0.2)" },
  { id: "moon", label: "Moon", tint: "rgba(160,160,160,0.35)" },
  { id: "lark", label: "Lark", tint: "rgba(242,236,218,0.2)" },
  { id: "juno", label: "Juno", tint: "rgba(143,196,143,0.2)" },
  { id: "slumber", label: "Slumber", tint: "rgba(125,105,24,0.2)" },
  { id: "crema", label: "Crema", tint: "rgba(234,205,163,0.15)" },
  { id: "reyes", label: "Reyes", tint: "rgba(220,200,180,0.2)" },
];

const EFFECTS: { id: string; label: string; icon: string }[] = [
  { id: "none", label: "None", icon: "✕" },
  { id: "blur_bg", label: "Blur BG", icon: "🌫" },
  { id: "vignette", label: "Vignette", icon: "⭕" },
  { id: "vintage", label: "Vintage", icon: "🎞" },
  { id: "neon", label: "Neon", icon: "💡" },
  { id: "dramatic", label: "Dramatic", icon: "🎭" },
];

type TextSticker = { id: number; text: string; x: number; y: number; color: string; fontSize: number };
type EmojiSticker = { id: number; emoji: string; x: number; y: number };

type AudienceChoice = "everyone" | "followers";

function clampSticker(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function DraggableSticker<E extends { id: number; x: number; y: number }>({
  sticker,
  maxX,
  maxY,
  setStickers,
  children,
}: {
  sticker: E;
  maxX: number;
  maxY: number;
  setStickers: Dispatch<SetStateAction<E[]>>;
  children: ReactNode;
}) {
  const start = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: sticker.x, y: sticker.y });
  posRef.current = { x: sticker.x, y: sticker.y };
  const stickerId = sticker.id;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = { ...posRef.current };
        },
        onPanResponderMove: (_, g) => {
          const nx = clampSticker(start.current.x + g.dx, 4, maxX);
          const ny = clampSticker(start.current.y + g.dy, 4, maxY);
          setStickers((prev) =>
            prev.map((s) => (s.id === stickerId ? ({ ...s, x: nx, y: ny } as E) : s)),
          );
        },
      }),
    [maxX, maxY, setStickers, stickerId],
  );

  return (
    <View
      {...pan.panHandlers}
      style={{ position: "absolute", left: sticker.x, top: sticker.y }}
    >
      {children}
    </View>
  );
}

export default function CreateReelScreen() {
  const params = useLocalSearchParams<{ draftId?: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState<FlowStep>("select");
  const [mediaTab, setMediaTab] = useState<"videos" | "photos">("videos");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [shareFeed, setShareFeed] = useState(true);
  const [shareProfile, setShareProfile] = useState(true);
  const [draftPersistId, setDraftPersistId] = useState<string | null>(null);
  const [postProgress, setPostProgress] = useState(0);
  const [postPhaseDone, setPostPhaseDone] = useState<{ upload: boolean; process: boolean; done: boolean }>({
    upload: false,
    process: false,
    done: false,
  });
  const [hydratingDraft, setHydratingDraft] = useState(false);

  const [isMuted, setIsMuted] = useState(true);
  const [textStickers, setTextStickers] = useState<TextSticker[]>([]);
  const [emojiStickers, setEmojiStickers] = useState<EmojiSticker[]>([]);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textDraftValue, setTextDraftValue] = useState("");
  const [textDraftColor, setTextDraftColor] = useState("#FFFFFF");
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [showBrightnessPanel, setShowBrightnessPanel] = useState(false);
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  const [showFilterStrip, setShowFilterStrip] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [activeFilter, setActiveFilter] = useState("normal");
  const [activeEffect, setActiveEffect] = useState("none");
  const [sharing, setSharing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState("");

  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [audience, setAudience] = useState<AudienceChoice>("everyone");

  const [galleryAssets, setGalleryAssets] = useState<MediaLibrary.Asset[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const videoRef = useRef<Video | null>(null);
  const [playing, setPlaying] = useState(false);
  const [editStatus, setEditStatus] = useState<AVPlaybackStatus | null>(null);

  const canProceedSelect = !!picked?.uri;

  useEffect(() => {
    setTextStickers([]);
    setEmojiStickers([]);
    setCoverImageUri(null);
    setIsMuted(true);
    setBrightness(1);
    setContrast(1);
    setActiveFilter("normal");
    setActiveEffect("none");
    setShowBrightnessPanel(false);
    setShowEffectsPanel(false);
    setShowFilterStrip(false);
    setShowEmojiPanel(false);
  }, [picked?.uri]);

  useEffect(() => {
    if (step !== "edit" || !picked?.uri || !isVideoMime(picked.mime)) return;
    let cancelled = false;
    void (async () => {
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled || !videoRef.current) return;
      try {
        await videoRef.current.playAsync();
        if (!cancelled) setPlaying(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, picked?.uri, picked?.mime]);

  const closeEditPanels = useCallback((except?: "brightness" | "effects" | "filters" | "emoji" | "text") => {
    if (except !== "brightness") setShowBrightnessPanel(false);
    if (except !== "effects") setShowEffectsPanel(false);
    if (except !== "filters") setShowFilterStrip(false);
    if (except !== "emoji") setShowEmojiPanel(false);
    if (except !== "text") setTextModalOpen(false);
  }, []);

  useEffect(() => {
    if (step !== "select") return undefined;
    let cancelled = false;
    void (async () => {
      setGalleryLoading(true);
      try {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (!perm.granted) {
          if (!cancelled) setGalleryAssets([]);
          return;
        }
        const g = await MediaLibrary.getAssetsAsync({
          first: 60,
          mediaType:
            mediaTab === "videos" ? MediaLibrary.MediaType.video : MediaLibrary.MediaType.photo,
          sortBy: MediaLibrary.SortBy.creationTime,
        });
        if (!cancelled) setGalleryAssets(g.assets);
      } catch {
        if (!cancelled) setGalleryAssets([]);
      } finally {
        if (!cancelled) setGalleryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, mediaTab]);

  useEffect(() => {
    let cancelled = false;
    const id = typeof params.draftId === "string" ? params.draftId : undefined;
    if (!id) {
      setHydratingDraft(false);
      setDraftPersistId(null);
      return () => {
        cancelled = true;
      };
    }
    setHydratingDraft(true);
    void (async () => {
      const d = await getReelDraft(id);
      if (cancelled) return;
      if (!d) {
        setHydratingDraft(false);
        Alert.alert("Draft not found", "This draft may have been deleted.");
        return;
      }
      setDraftPersistId(d.id);
      setCaption(d.caption);
      setHashtags(d.hashtags);
      const mime = d.mime ?? guessMime(d.localUri, "video/mp4");
      setPicked({ uri: d.localUri, mime });
      const s: FlowStep =
        d.step === "details" ? "details" : d.step === "edit" ? "edit" : "select";
      setStep(d.localUri ? s : "select");
      setHydratingDraft(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.draftId]);

  const tile = useMemo(() => {
    const w = Dimensions.get("window").width;
    const pad = 14;
    return Math.floor((w - pad * 2 - 8) / 3);
  }, []);

  const onEditTool = useCallback(
    (label: string) => {
      switch (label) {
        case "Audio":
          setIsMuted((m) => {
            const next = !m;
            void videoRef.current?.setIsMutedAsync(next);
            return next;
          });
          break;
        case "Text":
          setTextDraftValue("");
          setTextDraftColor("#FFFFFF");
          closeEditPanels("text");
          setTextModalOpen(true);
          break;
        case "Emoji":
          closeEditPanels("emoji");
          setShowEmojiPanel((p) => !p);
          break;
        case "Filters":
          closeEditPanels("filters");
          setShowFilterStrip((p) => !p);
          break;
        case "Brightness":
          closeEditPanels("brightness");
          setShowBrightnessPanel((p) => !p);
          break;
        case "Effects":
          closeEditPanels("effects");
          setShowEffectsPanel((p) => !p);
          break;
        default:
          break;
      }
    },
    [closeEditPanels],
  );

  const activeFilterTint = useMemo(
    () => FILTERS.find((f) => f.id === activeFilter)?.tint ?? null,
    [activeFilter],
  );

  const selectGalleryAsset = useCallback(async (asset: MediaLibrary.Asset) => {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false });
      const uri = info.localUri ?? asset.uri;
      const mime =
        asset.mediaType === "video" ? guessMime(uri, "video/mp4") : guessMime(uri, "image/jpeg");
      setPicked({ uri, mime, assetId: asset.id });
    } catch {
      Alert.alert("Could not load this item", "Try another clip or reopen the picker.");
    }
  }, []);

  const composeContent = useMemo(() => {
    const c = caption.trim();
    const h = hashtags.trim();
    if (c && h) return `${c}\n\n${h}`;
    return c || h;
  }, [caption, hashtags]);

  const togglePlayback = useCallback(async () => {
    if (!videoRef.current) return;
    if (playing) {
      await videoRef.current.pauseAsync();
      setPlaying(false);
    } else {
      await videoRef.current.playAsync();
      setPlaying(true);
    }
  }, [playing]);

  const pickVideo = async () => {
    if (mediaTab === "photos") {
      Alert.alert("Photos", "Reels use video only. Switch to Videos to choose a clip.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow Photos access to pick a reel video.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const mime = guessMime(asset.uri, asset.mimeType ?? "video/mp4");
    setPicked({ uri: asset.uri, mime });
  };

  const goBackWithinFlow = () => {
    if (step === "posting") return;
    if (step === "select") router.back();
    else if (step === "edit") setStep("select");
    else if (step === "details") setStep("edit");
  };

  const headerTitle =
    step === "select"
      ? "Select media"
      : step === "edit"
        ? "Edit reel"
        : step === "details"
          ? "Add details"
          : "Posting";

  const pickCoverImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow Photos to choose a cover image.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (r.canceled || !r.assets[0]?.uri) return;
    setCoverImageUri(r.assets[0].uri);
  };

  const onAddLocationPress = async () => {
    if (locationLabel) {
      setLocationLabel("");
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow location access to tag your reel.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const geo = await Location.reverseGeocodeAsync(loc.coords);
      const g = geo[0];
      const place =
        `${g?.city ?? ""}${g?.city && g?.region ? ", " : ""}${g?.region ?? ""}${g?.region && g?.country ? ", " : ""}${g?.country ?? ""}`.trim();
      setLocationLabel(place.replace(/^,\s*/, "") || "Unknown place");
    } catch {
      Alert.alert("Location unavailable", "Could not get your location.");
    }
  };

  const onAudiencePress = () => {
    Alert.alert("Audience", "Who can see this reel?", [
      { text: "Everyone", onPress: () => setAudience("everyone") },
      { text: "Followers only", onPress: () => setAudience("followers") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const persistDraftDetails = async () => {
    if (!picked) {
      Alert.alert("Pick a video", "Choose a video before saving a draft.");
      return;
    }
    try {
      const row = await saveReelDraft({
        id: draftPersistId ?? undefined,
        localUri: picked.uri,
        mime: picked.mime,
        caption,
        hashtags,
        step: "details" satisfies ReelDraftStep,
      });
      setDraftPersistId(row.id);
      Alert.alert("Draft saved", "You can resume from Quick Create → Drafts.");
      router.back();
    } catch {
      Alert.alert("Couldn't save draft", "Please try again.");
    }
  };

  const publishReel = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      Alert.alert("Sign in required", "You need an account to post.");
      return;
    }
    if (!picked?.uri) {
      Alert.alert("No video", "Please go back and select a video.");
      return;
    }
    if (!caption.trim()) {
      Alert.alert("Add caption", "Please write a caption for your reel.");
      return;
    }
    const isVideo = isVideoMime(picked.mime);

    setSharing(true);
    setUploadProgress(5);
    setUploadStep("Uploading video…");
    setStep("posting");
    setPostProgress(8);
    setPostPhaseDone({ upload: false, process: false, done: false });
    try {
      const name = picked.uri.split("/").pop() || "reel.mp4";
      const up = await mediaApi.upload(
        { uri: picked.uri, name, type: picked.mime },
        (pct) => setUploadProgress(Math.round(5 + pct * 0.4)),
      );
      setUploadProgress(45);
      setUploadStep("Processing…");
      setPostProgress(45);
      setPostPhaseDone((p) => ({ ...p, upload: true }));

      const videoDerivedThumb =
        isVideo && up.url.includes("/video/upload/")
          ? up.url
              .replace("/video/upload/", "/video/upload/w_720,q_auto,so_0,f_jpg/")
              .replace(/\.(mp4|mov|m4v|webm)(\?.*)?$/i, ".jpg$2")
          : null;

      let finalThumbnail = videoDerivedThumb;

      const customCover =
        coverImageUri && coverImageUri !== picked.uri ? coverImageUri : null;
      if (customCover) {
        setPostProgress(58);
        try {
          const coverName = customCover.split("/").pop() || "cover.jpg";
          const coverUp = await mediaApi.upload({
            uri: customCover,
            name: coverName.endsWith(".") ? "cover.jpg" : coverName,
            type: "image/jpeg",
          });
          finalThumbnail = coverUp.url;
        } catch {
          finalThumbnail = videoDerivedThumb;
        }
      }

      const inlineTags = (composeContent.match(/#[\w]+/g) ?? [])
        .map((t) => t.replace(/^#/, ""))
        .filter(Boolean);
      const inputTags = hashtags
        .split(/[\s,]+/)
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);
      const allTags = Array.from(
        new Set([...inputTags, ...inlineTags].map((t) => t.toLowerCase())),
      ).slice(0, 10);

      const captionFirst =
        caption.trim().split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
      const exploreTitle =
        captionFirst.length > 0 ? captionFirst.slice(0, 30).toUpperCase() : "REEL";

      const videoDurationSec =
        editStatus?.isLoaded && typeof editStatus.durationMillis === "number"
          ? editStatus.durationMillis / 1000
          : 0;

      setUploadProgress(72);
      setUploadStep("Publishing reel…");
      setPostProgress(72);
      setPostPhaseDone((p) => ({ ...p, process: true }));

      const created = await createAuthenticatedPost({
        type: isVideo ? "reel" : "text",
        content: composeContent.trim(),
        visibility: "public",
        media_url: up.url,
        thumbnail_url: finalThumbnail ?? null,
        cloudinary_public_id: up.public_id ?? null,
        tags: allTags,
        explore_title: exploreTitle,
        category: "general",
        aspect_width: 9,
        aspect_height: 16,
        video_duration: videoDurationSec,
        location: locationLabel.trim() || null,
        audience,
        share_to_feed: shareFeed,
        share_to_profile: shareProfile,
      });

      await refreshAfterPostCreate(queryClient, user?.email ?? "", {
        createdPost: created,
        username: user?.username,
      });

      await new Promise((r) => setTimeout(r, 320));
      setPostPhaseDone({ upload: true, process: true, done: true });
      setPostProgress(100);
      if (draftPersistId) await deleteReelDraft(draftPersistId);

      setUploadProgress(100);
      setUploadStep("Done!");

      Alert.alert("🎉 Reel Posted!", "Your reel is now live.", [
        {
          text: "View Reels",
          onPress: () => {
            router.dismissAll();
            router.replace("/reels");
          },
        },
        {
          text: "Go Home",
          onPress: () => {
            router.dismissAll();
            router.replace("/");
          },
        },
      ]);
    } catch (e: unknown) {
      Alert.alert("Upload failed", getApiErrorMessage(e), [{ text: "OK" }]);
      setStep("details");
    } finally {
      setSharing(false);
      setUploadProgress(0);
      setUploadStep("");
    }
  };

  const { height: winH } = Dimensions.get("window");
  const editVideoHeight = Math.max(420, Math.floor(winH * 0.58));
  const editStickerMax = useMemo(
    () => ({
      maxX: Math.max(80, Dimensions.get("window").width - 80),
      maxY: Math.max(120, editVideoHeight - 40),
    }),
    [editVideoHeight],
  );

  if (hydratingDraft) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgBlack, justifyContent: "center" }}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={{ color: MUTED, textAlign: "center", marginTop: 12 }}>Loading draft…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgBlack }} edges={["top", "bottom"]}>
      {step !== "posting" && step !== "edit" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={goBackWithinFlow} hitSlop={12} accessibilityRole="button">
              <Ionicons name="chevron-back" size={26} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerCenter}>{headerTitle}</Text>
            {step === "select" ? (
              <TouchableOpacity
                onPress={() => {
                  if (!picked) return;
                  setStep(isVideoMime(picked.mime) ? "edit" : "details");
                }}
                disabled={!canProceedSelect}
                style={[styles.hdrNext, !canProceedSelect && styles.hdrNextDisabled]}
              >
                <Text style={[styles.hdrNextTxt, !canProceedSelect && { opacity: 0.35 }]}>Next</Text>
              </TouchableOpacity>
            ) : step === "details" ? (
              <View style={{ width: 56 }} />
            ) : (
              <TouchableOpacity onPress={() => setStep("details")} style={styles.hdrNext}>
                <Text style={styles.hdrNextTxt}>Next</Text>
              </TouchableOpacity>
            )}
          </View>

          {step === "select" && (
            <View style={{ flex: 1 }}>
              <View style={styles.mediaBar}>
                <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>Library</Text>
                <TouchableOpacity activeOpacity={0.85} onPress={pickVideo} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: ACCENT, fontWeight: "700", fontSize: 14 }}>Open picker</Text>
                  <Feather name="chevron-right" size={14} color={ACCENT} />
                </TouchableOpacity>
              </View>

              <View style={styles.tabRow}>
                <Pressable style={styles.tab} onPress={() => setMediaTab("videos")}>
                  <Text style={[styles.tabTxt, mediaTab === "videos" && styles.tabTxtActive]}>Videos</Text>
                  {mediaTab === "videos" ? <View style={styles.tabLine} /> : null}
                </Pressable>
                <Pressable style={styles.tab} onPress={() => setMediaTab("photos")}>
                  <Text style={[styles.tabTxt, mediaTab === "photos" && styles.tabTxtActive]}>Photos</Text>
                  {mediaTab === "photos" ? <View style={styles.tabLine} /> : null}
                </Pressable>
              </View>

              <View style={{ flex: 1, minHeight: 200 }}>
                {galleryLoading ? (
                  <View style={{ paddingTop: 40, alignItems: "center" }}>
                    <ActivityIndicator color={ACCENT} />
                  </View>
                ) : (
                  <FlatList
                    data={galleryAssets}
                    numColumns={3}
                    keyboardShouldPersistTaps="handled"
                    style={{ flex: 1 }}
                    keyExtractor={(a) => a.id}
                    ListHeaderComponent={
                      picked ? (
                        <View style={{ marginHorizontal: 14, marginBottom: 12, borderRadius: 16, overflow: "hidden", height: 220, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                          {isVideoMime(picked.mime) ? (
                            <Video
                              source={{ uri: picked.uri }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode={ResizeMode.COVER}
                              isMuted
                              shouldPlay={false}
                            />
                          ) : (
                            <ExpoImage source={{ uri: picked.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                          )}
                        </View>
                      ) : (
                        <View style={{ marginHorizontal: 14, marginBottom: 14, paddingVertical: 16 }}>
                          <Text style={{ color: MUTED, textAlign: "center", fontSize: 13 }}>
                            Tap a clip or photo below. Videos publish as reels; photos publish as image posts with the same caption.
                          </Text>
                        </View>
                      )
                    }
                    renderItem={({ item }: { item: MediaLibrary.Asset }) => {
                      const sel = picked?.assetId === item.id;
                      return (
                        <TouchableOpacity
                          onPress={() => void selectGalleryAsset(item)}
                          activeOpacity={0.82}
                          style={{
                            width: tile,
                            height: tile,
                            marginHorizontal: 4,
                            marginBottom: 8,
                            borderRadius: 8,
                            overflow: "hidden",
                            borderWidth: sel ? 2 : 1,
                            borderColor: sel ? ACCENT : "rgba(255,255,255,0.1)",
                          }}
                        >
                          <ExpoImage
                            source={{ uri: item.uri }}
                            recyclingKey={item.id}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                          />
                          {item.mediaType === "video" ? (
                            <View style={StyleSheet.absoluteFillObject}>
                              <Ionicons
                                name="play-circle"
                                size={36}
                                color="rgba(255,255,255,0.92)"
                                style={{ position: "absolute", bottom: 6, right: 6 }}
                              />
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    }}
                    ListEmptyComponent={
                      !galleryLoading ? (
                        <Text style={{ color: MUTED, textAlign: "center", marginTop: 24, paddingHorizontal: 28 }}>
                          No media loaded. Allow library access or use Open picker above.
                        </Text>
                      ) : null
                    }
                  />
                )}
              </View>

              <View style={[styles.footerSel, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }]}>
                <Text style={{ color: MUTED, fontSize: 13 }}>{picked ? "1 selected" : "No selection"}</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!picked) return;
                    setStep(isVideoMime(picked.mime) ? "edit" : "details");
                  }}
                  disabled={!canProceedSelect}
                  style={[styles.nextCta, !canProceedSelect && { opacity: 0.35 }]}
                >
                  <Text style={styles.nextCtaTxt}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === "details" && (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 44 }}>
              <View style={{ flexDirection: "row", gap: 14 }}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => void pickCoverImage()}>
                  <View
                    style={{
                      width: 100,
                      height: 148,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.08)",
                      backgroundColor: "#0D1216",
                    }}
                  >
                    {coverImageUri ? (
                      <ExpoImage source={{ uri: coverImageUri }} style={{ flex: 1 }} contentFit="cover" />
                    ) : picked ? (
                      isVideoMime(picked.mime) ? (
                        <Video
                          source={{ uri: picked.uri }}
                          style={{ flex: 1 }}
                          resizeMode={ResizeMode.COVER}
                          isMuted
                          shouldPlay={false}
                        />
                      ) : (
                        <ExpoImage source={{ uri: picked.uri }} style={{ flex: 1 }} contentFit="cover" />
                      )
                    ) : null}
                    <View style={styles.coverOverlay}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>Edit Cover</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={{ color: MUTED, fontSize: 12 }}>Thumbnail preview</Text>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                    Covers use the opening frame for now.
                  </Text>
                </View>
              </View>

              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Write a caption…"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={[styles.input, { minHeight: 88 }]}
                multiline
                maxLength={2200}
              />
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 4, marginBottom: 8 }}>
                {caption.length}/2200
              </Text>
              <TextInput
                value={hashtags}
                onChangeText={setHashtags}
                placeholder="# Add hashtags"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.input}
                autoCapitalize="none"
              />

              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.detailRow}
                onPress={() => Alert.alert("Coming soon", "Tagging people will be available soon.")}
              >
                <Ionicons name="person-outline" size={20} color={MUTED} />
                <Text style={styles.detailRowTxt}>Tag people</Text>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.detailRow}
                onPress={() => Alert.alert("Coming soon", "Collaborators feature coming soon.")}
              >
                <Ionicons name="people-outline" size={20} color={MUTED} />
                <Text style={styles.detailRowTxt}>Add collaborators</Text>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <View style={styles.detailRow}>
                <TouchableOpacity
                  onPress={() => void onAddLocationPress()}
                  activeOpacity={0.75}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <Ionicons name="location-outline" size={20} color={MUTED} />
                  <Text style={[styles.detailRowTxt, { flex: 1 }]}>{locationLabel || "Add location"}</Text>
                </TouchableOpacity>
                {locationLabel ? (
                  <TouchableOpacity
                    onPress={() => setLocationLabel("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.35)" />
                  </TouchableOpacity>
                ) : (
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
                )}
              </View>
              <TouchableOpacity activeOpacity={0.75} style={styles.detailRow} onPress={onAudiencePress}>
                <Ionicons name="globe-outline" size={20} color={MUTED} />
                <Text style={styles.detailRowTxt}>Audience</Text>
                <Text style={[styles.detailRowTxt, { flex: 0, opacity: 0.45 }]}>
                  {audience === "everyone" ? "Everyone" : "Followers"}
                </Text>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>

              <Text style={styles.shareLabel}>Also share to</Text>
              <View style={styles.shareRow}>
                <Text style={styles.shareRowTxt}>Skiix Feed</Text>
                <Switch
                  value={shareFeed}
                  onValueChange={setShareFeed}
                  trackColor={{ false: "#2A2A2A", true: "rgba(0,229,255,0.35)" }}
                  thumbColor={shareFeed ? ACCENT : "#555"}
                />
              </View>
              <View style={styles.shareRow}>
                <Text style={styles.shareRowTxt}>Your Profile</Text>
                <Switch
                  value={shareProfile}
                  onValueChange={setShareProfile}
                  trackColor={{ false: "#2A2A2A", true: "rgba(0,229,255,0.35)" }}
                  thumbColor={shareProfile ? ACCENT : "#555"}
                />
              </View>

              {sharing && (
                <View style={styles.uploadProgressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {uploadStep} {Math.round(uploadProgress)}%
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.shareReelBtn, sharing && styles.shareReelBtnDisabled]}
                onPress={() => void publishReel()}
                activeOpacity={0.92}
                disabled={sharing}
              >
                {sharing ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <ActivityIndicator size="small" color="#000" />
                    <Text style={styles.shareReelBtnTxt}>Uploading…</Text>
                  </View>
                ) : (
                  <Text style={styles.shareReelBtnTxt}>Share Reel</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: "center", paddingVertical: 14 }} onPress={persistDraftDetails}>
                <Text style={{ color: ACCENT, fontWeight: "800", fontSize: 15 }}>Save Draft</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      )}

      {step === "edit" && picked && isVideoMime(picked.mime) && (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={[styles.headerBar, { paddingHorizontal: 16 }]}>
            <TouchableOpacity onPress={goBackWithinFlow}>
              <Ionicons name="chevron-back" size={26} color="white" />
            </TouchableOpacity>
            <Text style={[styles.headerCenter, { flex: 1 }]}>Edit reel</Text>
            <TouchableOpacity onPress={() => setStep("details")} style={styles.hdrNext}>
              <Text style={styles.hdrNextTxt}>Next</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, flexDirection: "row" }}>
            <View
              style={{
                flex: 1,
                height: editVideoHeight,
                alignSelf: "center",
                width: "100%",
                position: "relative",
              }}
            >
              <Video
                ref={(r) => {
                  videoRef.current = r;
                }}
                source={{ uri: picked.uri }}
                style={{ flex: 1, backgroundColor: "#000" }}
                resizeMode={ResizeMode.CONTAIN}
                isLooping
                isMuted={isMuted}
                onPlaybackStatusUpdate={(st) => {
                  if (st.isLoaded) setEditStatus(st);
                }}
                shouldPlay={playing}
              />

              {brightness !== 1 && (
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor:
                        brightness > 1
                          ? `rgba(255,255,255,${(brightness - 1) * 0.4})`
                          : `rgba(0,0,0,${(1 - brightness) * 0.55})`,
                    },
                  ]}
                />
              )}
              {contrast !== 1 && (
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor:
                        contrast > 1 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)",
                      opacity: Math.abs(contrast - 1) * 0.8,
                    },
                  ]}
                />
              )}
              {activeFilterTint ? (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFillObject, { backgroundColor: activeFilterTint }]}
                />
              ) : null}
              {activeEffect === "vintage" && (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(112,66,20,0.22)" }]}
                />
              )}
              {activeEffect === "neon" && (
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    { borderWidth: 3, borderColor: "rgba(0,229,255,0.45)" },
                  ]}
                />
              )}
              {activeEffect === "dramatic" && (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.28)" }]}
                />
              )}
              {activeEffect === "blur_bg" && (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.18)" }]}
                />
              )}
              {activeEffect === "vignette" && (
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.55)"]}
                  style={StyleSheet.absoluteFillObject}
                />
              )}

              <View style={[StyleSheet.absoluteFillObject, { pointerEvents: "box-none" }]}>
                {textStickers.map((s) => (
                  <DraggableSticker<TextSticker>
                    key={s.id}
                    sticker={s}
                    maxX={editStickerMax.maxX}
                    maxY={editStickerMax.maxY}
                    setStickers={setTextStickers}
                  >
                    <TouchableOpacity
                      onLongPress={() =>
                        setTextStickers((prev) => prev.filter((x) => x.id !== s.id))
                      }
                      delayLongPress={400}
                    >
                      <Text
                        style={{
                          color: s.color,
                          fontWeight: "800",
                          fontSize: s.fontSize,
                          textShadowColor: "rgba(0,0,0,0.85)",
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 4,
                        }}
                      >
                        {s.text}
                      </Text>
                    </TouchableOpacity>
                  </DraggableSticker>
                ))}
                {emojiStickers.map((s) => (
                  <DraggableSticker<EmojiSticker>
                    key={`e-${s.id}`}
                    sticker={s}
                    maxX={editStickerMax.maxX}
                    maxY={editStickerMax.maxY}
                    setStickers={setEmojiStickers}
                  >
                    <TouchableOpacity
                      onLongPress={() =>
                        setEmojiStickers((prev) => prev.filter((x) => x.id !== s.id))
                      }
                      delayLongPress={400}
                    >
                      <Text style={{ fontSize: 40 }}>{s.emoji}</Text>
                    </TouchableOpacity>
                  </DraggableSticker>
                ))}
              </View>

              {showBrightnessPanel && (
                <View style={styles.brightnessPanel}>
                  <Text style={styles.panelLabel}>Brightness</Text>
                  <Slider
                    style={styles.hSlider}
                    minimumValue={0.3}
                    maximumValue={2}
                    value={brightness}
                    onValueChange={setBrightness}
                    minimumTrackTintColor={ACCENT}
                    maximumTrackTintColor="#333333"
                    thumbTintColor={ACCENT}
                  />
                  <Text style={styles.sliderValue}>
                    {(brightness - 1) * 100 > 0 ? "+" : ""}
                    {Math.round((brightness - 1) * 100)}%
                  </Text>
                  <Text style={[styles.panelLabel, { marginTop: 8 }]}>Contrast</Text>
                  <Slider
                    style={styles.hSlider}
                    minimumValue={0.5}
                    maximumValue={1.5}
                    value={contrast}
                    onValueChange={setContrast}
                    minimumTrackTintColor={ACCENT}
                    maximumTrackTintColor="#333333"
                    thumbTintColor={ACCENT}
                  />
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={() => {
                      setBrightness(1);
                      setContrast(1);
                    }}
                  >
                    <Text style={styles.resetBtnText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.editTools}>
              {EDIT_REEL_TOOLS.map((t) => {
                const active =
                  (t.label === "Audio" && isMuted) ||
                  (t.label === "Text" && textModalOpen) ||
                  (t.label === "Emoji" && showEmojiPanel) ||
                  (t.label === "Filters" && showFilterStrip) ||
                  (t.label === "Brightness" && showBrightnessPanel) ||
                  (t.label === "Effects" && showEffectsPanel);
                return (
                  <TouchableOpacity
                    key={t.label}
                    style={[styles.toolBtn, active && styles.toolBtnActive]}
                    onPress={() => onEditTool(t.label)}
                    accessibilityLabel={t.label}
                  >
                    {t.label === "Audio" ? (
                      <Ionicons
                        name={isMuted ? "volume-mute" : "volume-high"}
                        size={22}
                        color={isMuted ? ACCENT : "#FFFFFF"}
                      />
                    ) : t.label === "Text" ? (
                      <Text style={[styles.sideBtnT, active && styles.sideBtnTActive]}>T</Text>
                    ) : t.label === "Emoji" ? (
                      <Ionicons
                        name="happy-outline"
                        size={22}
                        color={showEmojiPanel ? ACCENT : "#FFFFFF"}
                      />
                    ) : t.label === "Filters" ? (
                      <Ionicons
                        name="options-outline"
                        size={22}
                        color={showFilterStrip ? ACCENT : "#FFFFFF"}
                      />
                    ) : t.label === "Brightness" ? (
                      <Ionicons
                        name="sunny-outline"
                        size={22}
                        color={showBrightnessPanel ? ACCENT : "#FFFFFF"}
                      />
                    ) : (
                      <Ionicons
                        name="flash-outline"
                        size={22}
                        color={showEffectsPanel ? ACCENT : "#FFFFFF"}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {showFilterStrip && (
            <View style={styles.filterStrip}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}>
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.filterChip, activeFilter === f.id && styles.filterChipActive]}
                    onPress={() => setActiveFilter(f.id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        activeFilter === f.id && styles.filterChipTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {showEffectsPanel && (
            <View style={styles.effectsPanel}>
              <Text style={styles.panelTitle}>Effects</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.effectsRow}>
                  {EFFECTS.map((effect) => (
                    <TouchableOpacity
                      key={effect.id}
                      style={[
                        styles.effectItem,
                        activeEffect === effect.id && styles.effectItemActive,
                      ]}
                      onPress={() => setActiveEffect(effect.id)}
                    >
                      <Text style={styles.effectIcon}>{effect.icon}</Text>
                      <Text
                        style={[
                          styles.effectLabel,
                          activeEffect === effect.id && styles.effectLabelActive,
                        ]}
                      >
                        {effect.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.effectNote}>Preview on screen · baked in on export</Text>
            </View>
          )}

          {showEmojiPanel && (
            <View style={styles.emojiPanel}>
              <Text style={styles.panelTitle}>Add sticker</Text>
              <View style={styles.emojiGrid}>
                {POPULAR_EMOJIS.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.emojiItem}
                    onPress={() => {
                      setEmojiStickers((p) => [
                        ...p,
                        { id: Date.now(), emoji: item, x: 52, y: 140 },
                      ]);
                      setShowEmojiPanel(false);
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.editBottom}>
            <TouchableOpacity style={styles.playFab} onPress={() => void togglePlayback()}>
              <Ionicons name={playing ? "pause" : "play"} size={24} color="#000" />
            </TouchableOpacity>
            <Text style={{ color: MUTED, fontSize: 12, textAlign: "center" }}>
              Long-press overlays to remove · edits preview live
            </Text>
            <Text style={{ color: ACCENT, fontWeight: "800", fontSize: 12, marginTop: 6 }}>
              {editStatus?.isLoaded
                ? `${formatMs(editStatus.positionMillis ?? 0)} / ${formatMs(editStatus.durationMillis ?? 0)}`
                : "0:00 / —"}
            </Text>
          </View>
        </View>
      )}

      {step === "posting" && (
        <View style={styles.postingWrap}>
          <Text style={{ color: ACCENT, fontSize: 48, fontWeight: "900" }}>{Math.round(postProgress)}%</Text>
          <Text style={{ color: "white", fontWeight: "800", marginTop: 12, fontSize: 17, textAlign: "center" }}>
            {"Posting your reel… Please don't close the app."}
          </Text>
          <View style={{ marginTop: 28, gap: 14, width: "80%" }}>
            <CheckRow done={postPhaseDone.upload} label="Uploading video" spinner={!postPhaseDone.upload && postProgress > 0} />
            <CheckRow done={postPhaseDone.process} label="Processing" spinner={postPhaseDone.upload && !postPhaseDone.process} />
            <CheckRow done={postPhaseDone.done} label="Finalizing" spinner={postPhaseDone.process && !postPhaseDone.done} />
          </View>
        </View>
      )}

      <Modal transparent visible={textModalOpen} animationType="fade" onRequestClose={() => setTextModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24 }}>
          <View
            style={{
              backgroundColor: "#111111",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#1F1F1F",
              padding: 16,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, marginBottom: 10 }}>Add text</Text>
            <TextInput
              value={textDraftValue}
              onChangeText={setTextDraftValue}
              placeholder="Type something…"
              placeholderTextColor="#555555"
              style={{
                backgroundColor: "#0A0A0A",
                borderRadius: 10,
                padding: 12,
                color: textDraftColor,
                minHeight: 56,
                fontSize: 20,
                fontWeight: "700",
                textAlign: "center",
              }}
              autoFocus
              multiline
              maxLength={80}
            />
            <View style={styles.colorRow}>
              {TEXT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    textDraftColor === color && styles.colorDotActive,
                  ]}
                  onPress={() => setTextDraftColor(color)}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 18, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  setTextModalOpen(false);
                  setTextDraftValue("");
                }}
              >
                <Text style={{ color: MUTED, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!textDraftValue.trim()}
                style={{ opacity: textDraftValue.trim() ? 1 : 0.4 }}
                onPress={() => {
                  const t = textDraftValue.trim();
                  if (!t) return;
                  setTextStickers((p) => [
                    ...p,
                    {
                      id: Date.now(),
                      text: t,
                      x: 40,
                      y: 100,
                      color: textDraftColor,
                      fontSize: 24,
                    },
                  ]);
                  setTextModalOpen(false);
                  setTextDraftValue("");
                }}
              >
                <Text style={{ color: ACCENT, fontWeight: "900" }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function CheckRow({ done, label, spinner }: { done: boolean; label: string; spinner: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {done ? (
        <Ionicons name="checkmark-circle" size={22} color={ACCENT} />
      ) : spinner ? (
        <ActivityIndicator size="small" color={ACCENT} />
      ) : (
        <Ionicons name="ellipse-outline" size={22} color={MUTED} />
      )}
      <Text style={{ color: done ? "#fff" : MUTED, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCenter: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  hdrNext: { paddingHorizontal: 10, paddingVertical: 8 },
  hdrNextTxt: { color: ACCENT, fontWeight: "900", fontSize: 16 },
  hdrNextDisabled: { opacity: 0.35 },
  mediaBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    marginTop: 4,
    marginBottom: 10,
  },
  tabRow: { flexDirection: "row", paddingHorizontal: 18, gap: 24, marginBottom: 12 },
  tab: { paddingBottom: 8 },
  tabTxt: { color: MUTED, fontWeight: "700", fontSize: 15 },
  tabTxtActive: { color: "#fff" },
  tabLine: { height: 2, backgroundColor: ACCENT, marginTop: 6, borderRadius: 99 },
  pickZone: {
    marginHorizontal: 18,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0D1216",
    minHeight: 380,
    justifyContent: "center",
  },
  pickInner: { alignItems: "center", paddingVertical: 48, gap: 8 },
  pickTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  pickSub: { color: MUTED, fontSize: 13 },
  footerSel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginTop: 18,
  },
  nextCta: {
    backgroundColor: ACCENT,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 999,
  },
  nextCtaTxt: { color: "#000", fontWeight: "900", fontSize: 15 },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  input: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 14,
    color: "white",
    backgroundColor: "rgba(255,255,255,0.04)",
    fontSize: 15,
    textAlignVertical: "top",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  detailRowTxt: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600" },
  shareLabel: { color: MUTED, marginTop: 18, marginBottom: 8, fontWeight: "800", fontSize: 13 },
  shareRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  shareRowTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  shareReelBtn: {
    marginTop: 18,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  shareReelBtnTxt: { color: "#000", fontWeight: "900", fontSize: 17 },
  editTools: { width: 56, justifyContent: "center", gap: 12, paddingRight: 8, zIndex: 10 },
  toolBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(30,30,30,0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  toolBtnActive: {
    backgroundColor: "rgba(0,229,255,0.15)",
    borderColor: ACCENT,
  },
  sideBtnT: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  sideBtnTActive: { color: ACCENT },
  brightnessPanel: {
    position: "absolute",
    right: 8,
    top: "28%",
    backgroundColor: "rgba(20,20,20,0.95)",
    borderRadius: 16,
    padding: 14,
    width: 148,
    borderWidth: 1,
    borderColor: "#1F1F1F",
    zIndex: 20,
  },
  panelLabel: {
    color: "#888888",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    alignSelf: "flex-start",
  },
  hSlider: { width: "100%", height: 36 },
  sliderValue: { color: ACCENT, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  resetBtn: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    alignSelf: "center",
  },
  resetBtnText: { color: "#888888", fontSize: 12 },
  effectsPanel: {
    backgroundColor: "rgba(10,10,10,0.95)",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
  },
  panelTitle: {
    color: "#888888",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  effectsRow: { flexDirection: "row", gap: 12, paddingRight: 12 },
  effectItem: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#111111",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  effectItemActive: { borderColor: ACCENT, backgroundColor: "#0D2A35" },
  effectIcon: { fontSize: 22 },
  effectLabel: { color: "#888888", fontSize: 11 },
  effectLabelActive: { color: ACCENT },
  effectNote: { color: "#444444", fontSize: 11, textAlign: "center", marginTop: 8 },
  filterStrip: {
    backgroundColor: "rgba(10,10,10,0.9)",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111111",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  filterChipActive: { borderColor: ACCENT, backgroundColor: "#0D2A35" },
  filterChipText: { color: "#888888", fontSize: 13 },
  filterChipTextActive: { color: "#FFFFFF", fontWeight: "700" },
  emojiPanel: {
    backgroundColor: "rgba(10,10,10,0.95)",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
  },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiItem: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
  },
  colorRow: { flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 12 },
  colorDot: { width: 28, height: 28, borderRadius: 999, borderWidth: 2, borderColor: "transparent" },
  colorDotActive: { borderColor: "#FFFFFF", transform: [{ scale: 1.15 }] },
  uploadProgressWrap: { marginTop: 16 },
  progressTrack: {
    height: 4,
    backgroundColor: "#333333",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: ACCENT },
  progressText: { color: MUTED, fontSize: 12, marginTop: 8, textAlign: "center" },
  shareReelBtnDisabled: { opacity: 0.75 },
  editBottom: { paddingHorizontal: 16, paddingBottom: 28, gap: 6, alignItems: "center" },
  playFab: {
    backgroundColor: ACCENT,
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  postingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: Colors.bgBlack,
  },
});
