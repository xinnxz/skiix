import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import ViewShot from "react-native-view-shot";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/theme";
import { useAuth } from "@/store/auth.store";
import { mediaApi } from "@/utils/media.api";
import { storiesApi } from "@/utils/stories.api";
import { getApiErrorMessage } from "@/utils/getApiErrorMessage";
import { refreshAfterPostCreate } from "@/utils/postCreation";
import {
  deleteStoryDraft,
  getStoryDraft,
  saveStoryDraft,
  type StoryDraftStep,
} from "@/utils/storyDrafts.storage";

const SCREEN_W = Dimensions.get("window").width;

const PURPLE = "#7B2FBE";
const STORY_BTN = "#6B21A8";
const MUTED = "#888888";

const FILTERS = [
  { key: "Normal", tint: null as string | null },
  { key: "Clarendon", tint: "rgba(127,187,227,0.2)" },
  { key: "Gingham", tint: "rgba(230,231,224,0.15)" },
  { key: "Moon", tint: "rgba(160,160,160,0.3)" },
  { key: "Lark", tint: "rgba(242,236,218,0.2)" },
  { key: "Reyes", tint: "rgba(234,205,163,0.2)" },
  { key: "Juno", tint: "rgba(143,196,143,0.2)" },
  { key: "Slumber", tint: "rgba(125,105,24,0.2)" },
] as const;

const EMOJIS = [
  "🔥",
  "💯",
  "🚀",
  "⚡",
  "💪",
  "🎯",
  "✨",
  "🙌",
  "❤️",
  "😊",
  "🎉",
  "🌟",
  "💡",
  "🏆",
  "👏",
  "🤝",
];

const TEXT_COLORS = [
  "#FFFFFF",
  "#000000",
  "#FF4D4D",
  "#00E5FF",
  "#FFD700",
  "#22C55E",
  "#FF69B4",
  "#FF8C00",
];

type FlowStep = "capture" | "edit" | "details" | "posting";

type PickedMedia = { uri: string; mime: string; kind: "image" | "video" };

type TextOverlay = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  bold: boolean;
};

type StickerOverlay = {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
};

type LayoutMode = "single" | "split";

type OverlayStackEntry = { kind: "text" | "sticker"; id: string };

type Audience = "everyone" | "followers" | "close_friends";
type AllowReplies = "everyone" | "followers" | "none";

function guessMime(uri: string, fallback: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return fallback || "image/jpeg";
}

function stepToDraft(s: Exclude<FlowStep, "posting">): StoryDraftStep {
  return s;
}

function audienceLabel(a: Audience) {
  if (a === "everyone") return "Everyone";
  if (a === "followers") return "Followers";
  return "Close friends";
}

function repliesLabel(r: AllowReplies) {
  if (r === "everyone") return "Everyone";
  if (r === "followers") return "Followers";
  return "No one";
}

export default function CreateStoryScreen() {
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const viewShotRef = useRef<ViewShot | null>(null);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const email = user?.email ?? "";
  const params = useLocalSearchParams<{ draftId?: string }>();

  const [step, setStep] = useState<FlowStep>("capture");
  const [cameraFace, setCameraFace] = useState<"front" | "back">("back");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("single");

  const [picked, setPicked] = useState<PickedMedia | null>(null);
  const [filterKey, setFilterKey] = useState<string>("Normal");
  const [caption, setCaption] = useState("");
  const [storyLocation, setStoryLocation] = useState("");
  const [storyHashtags, setStoryHashtags] = useState("");
  const [audience, setAudience] = useState<Audience>("everyone");
  const [allowReplies, setAllowReplies] = useState<AllowReplies>("everyone");

  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [stickerOverlays, setStickerOverlays] = useState<StickerOverlay[]>([]);
  const [overlayStack, setOverlayStack] = useState<OverlayStackEntry[]>([]);

  const [exportUriForShare, setExportUriForShare] = useState<string | null>(null);

  const [showStickerModal, setShowStickerModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showHashtagModal, setShowHashtagModal] = useState(false);
  const [hashtagInput, setHashtagInput] = useState("");

  const [newText, setNewText] = useState("");
  const [selectedTextColor, setSelectedTextColor] = useState("#FFFFFF");
  const [isBold, setIsBold] = useState(false);
  const [fontSize, setFontSize] = useState(24);

  const [draftPersistId, setDraftPersistId] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);

  const [postProgress, setPostProgress] = useState(0);
  const [phases, setPhases] = useState({ up: false, proc: false, pub: false });
  const [sharing, setSharing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [boomerangMode, setBoomerangMode] = useState(false);

  const tint = useMemo(() => FILTERS.find((f) => f.key === filterKey)?.tint ?? null, [filterKey]);

  const resetOverlays = useCallback(() => {
    setTextOverlays([]);
    setStickerOverlays([]);
    setOverlayStack([]);
    setExportUriForShare(null);
  }, []);

  useEffect(() => {
    void requestCamPermission();
  }, [requestCamPermission]);

  useEffect(() => {
    let cancelled = false;
    const id = typeof params.draftId === "string" ? params.draftId : undefined;
    if (!id) {
      setHydrating(false);
      return () => {
        cancelled = true;
      };
    }
    setHydrating(true);
    void (async () => {
      const d = await getStoryDraft(id);
      if (cancelled) return;
      if (!d) {
        setHydrating(false);
        Alert.alert("Draft not found", "This story draft may have been deleted.");
        return;
      }
      setDraftPersistId(d.id);
      setCaption((d.caption ?? "").slice(0, 150));
      setFilterKey(d.filterKey || "Normal");
      resetOverlays();
      setPicked({ uri: d.localUri, mime: d.mime, kind: d.mediaKind });
      const st: FlowStep =
        d.step === "capture" ? "capture" : d.step === "edit" ? "edit" : "details";
      setStep(st);
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.draftId, resetOverlays]);

  const persistDraft = async (s: Exclude<FlowStep, "posting">) => {
    if (!picked) throw new Error("no media");
    const row = await saveStoryDraft({
      id: draftPersistId ?? undefined,
      localUri: picked.uri,
      mime: picked.mime,
      mediaKind: picked.kind,
      caption,
      filterKey,
      step: stepToDraft(s),
    });
    setDraftPersistId(row.id);
    return row;
  };

  const pickLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow Photos access to pick a story.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.92,
      videoMaxDuration: 60,
    });
    if (r.canceled) return;
    const a = r.assets?.[0];
    if (!a?.uri) return;
    const mime = guessMime(a.uri, a.mimeType ?? "image/jpeg");
    const kind = mime.startsWith("video/") ? "video" : "image";
    resetOverlays();
    setPicked({ uri: a.uri, mime, kind });
    if (layoutMode === "split" && kind === "video") {
      setLayoutMode("single");
      toast.info("Layout set to single for video.");
    }
  };

  const shutterCapture = async () => {
    try {
      if ((camPermission?.granted ?? false) && camRef.current && !picked) {
        const shot = await camRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
        if (shot?.uri) {
          const mime = guessMime(shot.uri, "image/jpeg");
          resetOverlays();
          setPicked({ uri: shot.uri, mime, kind: "image" });
          return;
        }
      }
    } catch {
      /* fall through */
    }
    await takePhoto();
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow Camera access to capture a moment.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
      videoMaxDuration: 60,
      cameraType:
        cameraFace === "front" ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });
    if (r.canceled) return;
    const a = r.assets?.[0];
    if (!a?.uri) return;
    const mime = guessMime(a.uri, a.mimeType ?? "image/jpeg");
    const kind = mime.startsWith("video/") ? "video" : "image";
    resetOverlays();
    setPicked({ uri: a.uri, mime, kind });
    if (layoutMode === "split" && kind === "video") {
      setLayoutMode("single");
      toast.info("Layout set to single for video.");
    }
  };

  const goBack = useCallback(() => {
    if (step === "posting") return;
    if (step === "capture") router.back();
    else if (step === "edit") setStep("capture");
    else if (step === "details") {
      setExportUriForShare(null);
      setStep("edit");
    }
  }, [step]);

  const handleUndo = () => {
    setOverlayStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      const removed = prev[prev.length - 1];
      if (removed.kind === "text") {
        setTextOverlays((t) => t.filter((x) => x.id !== removed.id));
      } else {
        setStickerOverlays((s) => s.filter((x) => x.id !== removed.id));
      }
      return next;
    });
  };

  const addTextOverlay = (t: Omit<TextOverlay, "id">) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setTextOverlays((prev) => [...prev, { ...t, id }]);
    setOverlayStack((prev) => [...prev, { kind: "text", id }]);
  };

  const addStickerOverlay = (emoji: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setStickerOverlays((prev) => [
      ...prev,
      { id, emoji, x: SCREEN_W * 0.42, y: 160, size: 48 },
    ]);
    setOverlayStack((prev) => [...prev, { kind: "sticker", id }]);
  };

  const handleCaptureTextTool = () => {
    setNewText("");
    setSelectedTextColor("#FFFFFF");
    setFontSize(24);
    setIsBold(false);
    setShowTextModal(true);
  };

  const handleBoomerang = () => {
    setBoomerangMode((prev) => {
      const next = !prev;
      if (next) {
        Alert.alert(
          "♾️ Boomerang",
          "Boomerang records a short burst and plays it forwards and backwards.\n\nTap the shutter to capture!",
          [{ text: "Got it!" }],
        );
      }
      return next;
    });
  };

  const handleLayoutTool = () => {
    Alert.alert("Layout", "Choose layout", [
      { text: "Single (default)", onPress: () => setLayoutMode("single") },
      { text: "Split top/bottom", onPress: () => setLayoutMode("split") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleDownload = async () => {
    if (picked?.kind !== "image") {
      Alert.alert("Not available", "Saving to gallery works for photos in this build.");
      return;
    }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow access to save to your gallery.");
        return;
      }
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        Alert.alert("Error", "Could not capture the story preview.");
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved!", "Story saved to your gallery.");
    } catch {
      Alert.alert("Error", "Could not save to gallery.");
    }
  };

  const handleAddLocation = async () => {
    if (storyLocation) {
      setStoryLocation("");
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Enable location to tag this story.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const geo = await Location.reverseGeocodeAsync(loc.coords);
      const g = geo[0];
      if (g) {
        const place = [g.city, g.region, g.country].filter(Boolean).join(", ");
        setStoryLocation(place || "Unknown place");
      }
    } catch {
      Alert.alert("Location unavailable", "Could not resolve your location.");
    }
  };

  const confirmTextModal = () => {
    if (!newText.trim()) return;
    addTextOverlay({
      text: newText.trim(),
      x: SCREEN_W * 0.5 - 80,
      y: 200,
      color: selectedTextColor,
      fontSize,
      bold: isBold,
    });
    setNewText("");
    setShowTextModal(false);
  };

  const publishStory = async () => {
    if (!picked) {
      Alert.alert("Error", "No image selected. Please go back and select media.");
      return;
    }
    if (!email) {
      Alert.alert("Sign in required", "You need to be signed in to share a story.");
      return;
    }

    if (__DEV__) {
      console.log("[Story] Starting share…", {
        email,
        location: storyLocation,
        caption: caption.trim(),
        hasExport: Boolean(exportUriForShare),
      });
    }

    setSharing(true);
    setUploadProgress(10);
    setStep("posting");
    setPostProgress(12);
    setPhases({ up: false, proc: false, pub: false });

    try {
      const isVideo = picked.kind === "video";
      let uploadUri = isVideo ? picked.uri : exportUriForShare ?? picked.uri;

      if (!isVideo && textOverlays.length + stickerOverlays.length > 0 && !exportUriForShare) {
        try {
          const cap = await viewShotRef.current?.capture?.();
          if (cap) uploadUri = cap;
        } catch {
          /* use base uri */
        }
      }

      const name = uploadUri.split("/").pop() || (isVideo ? "story.mp4" : "story.jpg");
      const uploadMime = isVideo ? picked.mime : "image/jpeg";

      setUploadProgress(35);
      setPostProgress(35);
      const up = await mediaApi.upload(
        { uri: uploadUri, name, type: uploadMime },
        (pct) => setUploadProgress(Math.round(10 + pct * 0.55)),
      );
      const mt = up.resource_type === "video" ? "video" : "image";

      setUploadProgress(70);
      setPostProgress(70);
      setPhases({ up: true, proc: false, pub: false });

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await storiesApi.create({
        author_email: email.toLowerCase(),
        media_url: up.url,
        media_type: mt,
        caption: caption.trim() || undefined,
        expires_at: expiresAt,
        location: storyLocation.trim() || undefined,
        hashtags: storyHashtags.trim() || undefined,
        audience,
        allow_replies: allowReplies,
      });

      setUploadProgress(100);
      setPostProgress(82);
      setPhases({ up: true, proc: true, pub: false });
      await new Promise((r) => setTimeout(r, 300));
      setPhases({ up: true, proc: true, pub: true });
      setPostProgress(100);

      if (draftPersistId) await deleteStoryDraft(draftPersistId);

      await refreshAfterPostCreate(queryClient, email, { refreshStories: true });

      Alert.alert("Story shared!", "Your story is now live for 24 hours.", [
        {
          text: "View Feed",
          onPress: () => {
            router.dismissAll();
            router.replace("/(root)/(tabs)");
          },
        },
      ]);
    } catch (e: unknown) {
      if (__DEV__) console.error("[Story] publish failed", e);
      Alert.alert("Failed to share", getApiErrorMessage(e), [{ text: "Try again" }]);
      setStep("details");
    } finally {
      setSharing(false);
      setUploadProgress(0);
    }
  };

  const saveDraftButton = () => {
    Alert.alert("Coming soon", "Story drafts will be available soon!");
  };

  const mediaInner = (videoPlaying: boolean) => {
    if (!picked) return null;
    const uri = picked.uri;
    if (picked.kind === "video") {
      return (
        <Video
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isMuted
          shouldPlay={videoPlaying}
          isLooping
        />
      );
    }
    if (layoutMode === "split") {
      return (
        <View style={{ flex: 1, flexDirection: "column" }}>
          <View style={{ flex: 1, overflow: "hidden" }}>
            <Image
              source={{ uri }}
              style={{ width: "100%", height: "200%", position: "absolute", top: 0 }}
              contentFit="cover"
            />
          </View>
          <View style={{ height: 2, backgroundColor: "rgba(255,255,255,0.35)" }} />
          <View style={{ flex: 1, overflow: "hidden" }}>
            <Image
              source={{ uri }}
              style={{ width: "100%", height: "200%", position: "absolute", bottom: 0 }}
              contentFit="cover"
            />
          </View>
        </View>
      );
    }
    return <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />;
  };

  const overlayLayer = () => (
    <>
      {textOverlays.map((overlay) => (
        <TouchableOpacity
          key={overlay.id}
          style={[styles.textOverlay, { left: overlay.x, top: overlay.y }]}
          onLongPress={() => {
            Alert.alert("Remove text?", undefined, [
              {
                text: "Remove",
                style: "destructive",
                onPress: () => {
                  setTextOverlays((prev) => prev.filter((o) => o.id !== overlay.id));
                  setOverlayStack((prev) => prev.filter((e) => !(e.kind === "text" && e.id === overlay.id)));
                },
              },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
        >
          <Text
            style={{
              color: overlay.color,
              fontSize: overlay.fontSize,
              fontWeight: overlay.bold ? "800" : "600",
              textShadowColor: "rgba(0,0,0,0.5)",
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {overlay.text}
          </Text>
        </TouchableOpacity>
      ))}
      {stickerOverlays.map((sticker) => (
        <TouchableOpacity
          key={sticker.id}
          style={[styles.stickerOverlay, { left: sticker.x, top: sticker.y }]}
          onLongPress={() => {
            setStickerOverlays((prev) => prev.filter((s) => s.id !== sticker.id));
            setOverlayStack((prev) => prev.filter((e) => !(e.kind === "sticker" && e.id === sticker.id)));
          }}
        >
          <Text style={{ fontSize: sticker.size }}>{sticker.emoji}</Text>
        </TouchableOpacity>
      ))}
    </>
  );

  const previewVisual = ({
    height,
    fill,
    flatExport,
    videoPlaying,
    withViewShotRef,
    minHeight,
  }: {
    height?: number;
    fill?: boolean;
    flatExport?: boolean;
    videoPlaying?: boolean;
    withViewShotRef?: boolean;
    minHeight?: number;
  }) => {
    const play = videoPlaying ?? false;

    const boxStyle = [
      styles.previewBox,
      height != null ? { height } : null,
      minHeight != null ? { minHeight } : null,
      fill ? { flex: 1 } : null,
    ];

    if (withViewShotRef && picked?.kind === "image") {
      return (
        <View style={[boxStyle, { flex: fill ? 1 : undefined }]} collapsable={false}>
          <ViewShot ref={viewShotRef} style={StyleSheet.absoluteFill}>
            <>
              {mediaInner(false)}
              {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
              {overlayLayer()}
            </>
          </ViewShot>
        </View>
      );
    }

    if (flatExport && picked?.kind === "image") {
      const uri = exportUriForShare ?? picked.uri;
      return (
        <View style={boxStyle}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      );
    }

    if (!picked) {
      return (
        <View style={boxStyle}>
          <View style={[StyleSheet.absoluteFill, styles.viewportEmpty]}>
            <Feather name="aperture" size={42} color="rgba(255,255,255,0.2)" />
          </View>
        </View>
      );
    }

    return (
      <View style={boxStyle}>
        {mediaInner(play)}
        {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
        {overlayLayer()}
      </View>
    );
  };

  const advanceFromEdit = async () => {
    if (!picked) return;
    try {
      await persistDraft("edit");
    } catch {
      /* non-fatal */
    }
    if (picked.kind === "image") {
      await new Promise((r) => setTimeout(r, 80));
      try {
        const cap = await viewShotRef.current?.capture?.();
        if (cap) setExportUriForShare(cap);
        else {
          Alert.alert("Export failed", "Could not prepare your story image. Try again.");
          return;
        }
      } catch {
        Alert.alert("Export failed", "Could not prepare your story image. Try again.");
        return;
      }
    } else {
      setExportUriForShare(null);
    }
    setStep("details");
  };

  if (hydrating) {
    return (
      <SafeAreaView style={[styles.flexCenter, { backgroundColor: Colors.bgBlack }]}>
        <ActivityIndicator color={PURPLE} size="large" />
        <Text style={{ color: MUTED, marginTop: 12 }}>Loading draft…</Text>
      </SafeAreaView>
    );
  }

  if (step === "posting") {
    return (
      <SafeAreaView style={[styles.flexCenter, { backgroundColor: Colors.bgBlack }]} edges={["top", "bottom"]}>
        <View style={styles.ringOuter}>
          <Text style={styles.ringPct}>{Math.round(postProgress)}%</Text>
        </View>
        <Text style={styles.postTitle}>Sharing your story…</Text>
        <Text style={styles.postSub}>{"Please don't close the app."}</Text>
        <View style={{ marginTop: 28, gap: 14, alignSelf: "stretch", paddingHorizontal: 36 }}>
          <RowCheck done={phases.up} label="Uploading media" spinner={!phases.up && postProgress > 5} />
          <RowCheck done={phases.proc} label="Processing" spinner={phases.up && !phases.proc} />
          <RowCheck done={phases.pub} label="Publishing" spinner={phases.proc && !phases.pub} />
        </View>
        <View style={styles.lineBarOuter}>
          <View style={[styles.lineBarInner, { width: `${Math.min(100, postProgress)}%` }]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }} edges={["top", "bottom"]}>
      {step === "capture" && (
        <>
          <View style={styles.capHead}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="close" size={26} color="white" />
            </TouchableOpacity>
            <Text style={styles.capTitle}>Add Story</Text>
            <TouchableOpacity onPress={() => Alert.alert("Settings", "Story settings arrive soon.")} hitSlop={12}>
              <Ionicons name="settings-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, flexDirection: "row" }}>
            <View style={styles.sideTools}>
              <TouchableOpacity style={styles.sideBtn} onPress={handleCaptureTextTool}>
                <Feather name="type" size={22} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sideBtn, boomerangMode && styles.sideBtnActive]}
                onPress={handleBoomerang}
              >
                <Text style={[styles.boomerangIcon, boomerangMode && styles.boomerangIconActive]}>∞</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sideBtn} onPress={handleLayoutTool}>
                <Ionicons name="grid-outline" size={22} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sideBtn} onPress={() => setShowStickerModal(true)}>
                <Ionicons name="happy-outline" size={22} color="white" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={[styles.viewport, { minHeight: 320 }]}>
                {picked ? (
                  <View style={[styles.viewport, { minHeight: 380 }]}>
                    {previewVisual({ height: undefined, minHeight: 380, videoPlaying: true })}
                    {boomerangMode ? (
                      <View style={styles.boomerangIndicator} pointerEvents="none">
                        <Text style={styles.boomerangIndicatorText}>♾️ BOOMERANG</Text>
                      </View>
                    ) : null}
                  </View>
                ) : camPermission?.granted ? (
                  <CameraView
                    ref={camRef}
                    style={[styles.viewport, { minHeight: 380 }]}
                    facing={cameraFace === "front" ? "front" : "back"}
                  />
                ) : (
                  <Pressable style={[styles.viewport, { minHeight: 380 }]} onPress={() => void requestCamPermission()}>
                    <View style={[StyleSheet.absoluteFill, styles.viewportEmpty]}>
                      <Text style={{ color: MUTED, textAlign: "center", paddingHorizontal: 24 }}>
                        Allow camera access for a live preview, or pick from gallery with the shutter.
                      </Text>
                    </View>
                  </Pressable>
                )}
              </View>
              <View style={styles.shutterRow}>
                <TouchableOpacity style={styles.thumbBox} onPress={pickLibrary}>
                  <Ionicons name="images-outline" size={22} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.shutter} onPress={() => void shutterCapture()}>
                  <View style={styles.shutterInner} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.flipBtn}
                  onPress={() => setCameraFace((f) => (f === "back" ? "front" : "back"))}
                >
                  <Ionicons name="camera-reverse-outline" size={26} color="white" />
                </TouchableOpacity>
              </View>
              <View style={{ alignItems: "center", paddingVertical: 14 }}>
                <Text style={[styles.modeTxtOn, { fontSize: 13, letterSpacing: 2 }]}>STORY</Text>
                <View style={[styles.modeLine, { width: 48, marginTop: 8 }]} />
              </View>
              <TouchableOpacity
                disabled={!picked}
                onPress={() => {
                  void persistDraft("capture").catch(() => undefined);
                  setStep("edit");
                }}
                style={[styles.capNextBig, !picked && { opacity: 0.4 }]}
              >
                <Text style={styles.capNextTxt}>Continue to edit</Text>
                <Feather name="chevron-right" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {(step === "edit" || step === "details") && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {step === "edit" ? (
            <>
              <View style={styles.capHead}>
                <TouchableOpacity onPress={goBack} hitSlop={10}>
                  <Ionicons name="close" size={26} color="white" />
                </TouchableOpacity>
                <Text style={[styles.capTitle, { flex: 1, textAlign: "center", marginHorizontal: 6 }]}>
                  Edit Story
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <TouchableOpacity style={styles.headerBtn} onPress={handleUndo} hitSlop={8}>
                    <Ionicons name="arrow-undo-outline" size={22} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerBtn} onPress={() => void handleDownload()} hitSlop={8}>
                    <Ionicons name="download-outline" size={22} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolScroll}>
                <TouchableOpacity style={styles.topToolChip} onPress={() => setShowStickerModal(true)}>
                  <Ionicons name="happy-outline" size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.topToolChip}
                  onPress={() => Alert.alert("Coming soon", "Drawing tool coming soon! ✏️")}
                >
                  <Ionicons name="create-outline" size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.topToolChip}
                  onPress={() => {
                    setNewText("");
                    setShowTextModal(true);
                  }}
                >
                  <Text style={styles.topToolAa}>Aa</Text>
                </TouchableOpacity>
              </ScrollView>

              <View style={{ flex: 1, marginHorizontal: 12 }}>
                {picked?.kind === "image" ? (
                  previewVisual({ fill: true, videoPlaying: false, withViewShotRef: true, minHeight: 420 })
                ) : picked ? (
                  previewVisual({ fill: true, videoPlaying: true, minHeight: 420 })
                ) : null}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterStrip}>
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setFilterKey(f.key)}
                    style={[styles.filterPill, filterKey === f.key && styles.filterPillOn]}
                  >
                    <Text style={[styles.filterPillTxt, filterKey === f.key && { color: "#fff" }]}>{f.key}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.editFooter}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={styles.storyAvatarRing}>
                    {user?.avatar_url ? (
                      <Image source={{ uri: user.avatar_url }} style={styles.miniAv} />
                    ) : (
                      <View style={[styles.miniAv, styles.miniAvFallback]}>
                        <Ionicons name="person" size={20} color="white" />
                      </View>
                    )}
                  </View>
                  <Text style={{ color: "#fff", fontWeight: "800", marginLeft: 10, fontSize: 14 }}>Your Story</Text>
                </View>
                <TouchableOpacity
                  style={[styles.editNextPurple, { backgroundColor: STORY_BTN }]}
                  onPress={() => void advanceFromEdit()}
                >
                  <Text style={styles.editNextTxt}>Next </Text>
                  <Feather name="chevron-right" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.capHead}>
                <TouchableOpacity onPress={goBack}>
                  <Ionicons name="chevron-back" size={26} color="white" />
                </TouchableOpacity>
                <Text style={[styles.capTitle, { flex: 1 }]}>Story Details</Text>
                <View style={{ width: 26 }} />
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
                <View style={[styles.miniPreviewRow, { height: 220 }]}>
                  {picked ? (
                    picked.kind === "video" ? (
                      previewVisual({ height: 220, videoPlaying: true })
                    ) : (
                      previewVisual({ height: 220, flatExport: true })
                    )
                  ) : null}
                </View>
                <Text style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>{caption.trim().length}/150</Text>
                <TextInput
                  value={caption}
                  onChangeText={(t) => setCaption(t.slice(0, 150))}
                  placeholder="Write a caption…"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.captionArea}
                  multiline
                  maxLength={150}
                />
                <TouchableOpacity style={styles.detailRow} onPress={() => void handleAddLocation()}>
                  <Ionicons
                    name="ellipse-outline"
                    size={20}
                    color={storyLocation ? PURPLE : MUTED}
                  />
                  <Text style={styles.detailRowTxt}>{storyLocation || "Add location"}</Text>
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() => Alert.alert("Coming soon", "Mentions coming soon!")}
                >
                  <Ionicons name="ellipse-outline" size={20} color={MUTED} />
                  <Text style={styles.detailRowTxt}>Mention people</Text>
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailRow} onPress={() => setShowHashtagModal(true)}>
                  <Ionicons name="ellipse-outline" size={20} color={storyHashtags ? PURPLE : MUTED} />
                  <Text style={styles.detailRowTxt}>{storyHashtags || "Add hashtag"}</Text>
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() =>
                    Alert.alert("Who can see this story?", undefined, [
                      { text: "Everyone", onPress: () => setAudience("everyone") },
                      { text: "Followers only", onPress: () => setAudience("followers") },
                      { text: "Close friends", onPress: () => setAudience("close_friends") },
                      { text: "Cancel", style: "cancel" },
                    ])
                  }
                >
                  <Text style={styles.detailRowTxt}>Who can see this story?</Text>
                  <Text style={{ color: PURPLE, fontWeight: "800", fontSize: 14 }}>
                    {audienceLabel(audience)} ›
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() =>
                    Alert.alert("Allow replies", undefined, [
                      { text: "Everyone", onPress: () => setAllowReplies("everyone") },
                      { text: "Followers only", onPress: () => setAllowReplies("followers") },
                      { text: "No one", onPress: () => setAllowReplies("none") },
                      { text: "Cancel", style: "cancel" },
                    ])
                  }
                >
                  <Text style={styles.detailRowTxt}>Allow replies</Text>
                  <Text style={{ color: PURPLE, fontWeight: "800", fontSize: 14 }}>
                    {repliesLabel(allowReplies)} ›
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.helpHint, { marginTop: 8 }]}>Stories disappear after 24 hours.</Text>

                {sharing ? (
                  <View style={styles.uploadProgress}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {uploadProgress < 70 ? "Uploading media…" : "Sharing story…"} {uploadProgress}%
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.shareHuge,
                    { backgroundColor: STORY_BTN },
                    sharing && styles.shareHugeDisabled,
                  ]}
                  activeOpacity={0.92}
                  onPress={() => void publishStory()}
                  disabled={sharing}
                >
                  {sharing ? (
                    <View style={styles.shareBtnContent}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.shareHugeTxt}>Sharing…</Text>
                    </View>
                  ) : (
                    <Text style={styles.shareHugeTxt}>Share to Story</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: "center", paddingVertical: 14 }} onPress={saveDraftButton}>
                  <Text style={{ color: PURPLE, fontWeight: "800", fontSize: 15 }}>Save Draft</Text>
                </TouchableOpacity>
              </ScrollView>
            </>
          )}
        </KeyboardAvoidingView>
      )}

      <Modal visible={showTextModal} transparent animationType="fade" onRequestClose={() => setShowTextModal(false)}>
        <View style={styles.textModalBg}>
          <View style={styles.textModal}>
            <Text style={styles.textModalTitle}>Add Text</Text>
            <TextInput
              style={[styles.textModalInput, { color: selectedTextColor }]}
              placeholder="Type something…"
              placeholderTextColor="#555"
              value={newText}
              onChangeText={setNewText}
              autoFocus
              multiline
              maxLength={100}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {TEXT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorDot,
                      { backgroundColor: color },
                      selectedTextColor === color && styles.colorDotActive,
                    ]}
                    onPress={() => setSelectedTextColor(color)}
                  />
                ))}
              </View>
            </ScrollView>
            <View style={styles.fontSizeRow}>
              <Text style={styles.fontSizeLabel}>Size</Text>
              <TouchableOpacity style={styles.fontSizeBtn} onPress={() => setFontSize((s) => Math.max(14, s - 4))}>
                <Text style={styles.fontSizeBtnText}>A-</Text>
              </TouchableOpacity>
              <Text style={styles.fontSizeValue}>{fontSize}</Text>
              <TouchableOpacity style={styles.fontSizeBtn} onPress={() => setFontSize((s) => Math.min(48, s + 4))}>
                <Text style={styles.fontSizeBtnText}>A+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.boldBtn, isBold && styles.boldBtnActive]}
                onPress={() => setIsBold((v) => !v)}
              >
                <Text style={[styles.boldBtnText, isBold && styles.boldBtnTextActive]}>B</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.textModalBtns}>
              <TouchableOpacity
                style={styles.textModalCancel}
                onPress={() => {
                  setShowTextModal(false);
                  setNewText("");
                }}
              >
                <Text style={styles.textModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.textModalAdd, { backgroundColor: STORY_BTN }, !newText.trim() && { opacity: 0.4 }]}
                onPress={confirmTextModal}
                disabled={!newText.trim()}
              >
                <Text style={styles.textModalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showStickerModal} transparent animationType="slide" onRequestClose={() => setShowStickerModal(false)}>
        <View style={styles.stickerModalBg}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowStickerModal(false)} />
          <View style={styles.stickerSheet}>
            <Text style={styles.stickerSheetTitle}>Add sticker</Text>
            <View style={styles.stickerGrid}>
              {EMOJIS.map((em) => (
                <TouchableOpacity
                  key={em}
                  style={styles.stickerItem}
                  onPress={() => {
                    addStickerOverlay(em);
                    setShowStickerModal(false);
                  }}
                >
                  <Text style={styles.stickerEmoji}>{em}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showHashtagModal} transparent animationType="fade" onRequestClose={() => setShowHashtagModal(false)}>
        <View style={styles.textModalBg}>
          <View style={styles.textModal}>
            <Text style={styles.textModalTitle}>Add hashtag</Text>
            <TextInput
              style={styles.textModalInput}
              placeholder="#skiix"
              placeholderTextColor="#555"
              value={hashtagInput}
              onChangeText={setHashtagInput}
              autoCapitalize="none"
            />
            <View style={styles.textModalBtns}>
              <TouchableOpacity
                style={styles.textModalCancel}
                onPress={() => {
                  setShowHashtagModal(false);
                  setHashtagInput("");
                }}
              >
                <Text style={styles.textModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.textModalAdd, { backgroundColor: STORY_BTN }]}
                onPress={() => {
                  const raw = hashtagInput.trim().replace(/^#+/, "");
                  if (raw) {
                    const tag = `#${raw}`;
                    setStoryHashtags((prev) => (prev ? `${prev} ${tag}` : tag));
                  }
                  setHashtagInput("");
                  setShowHashtagModal(false);
                }}
              >
                <Text style={styles.textModalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function RowCheck({
  done,
  label,
  spinner,
}: {
  done: boolean;
  label: string;
  spinner: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {done ? (
        <Ionicons name="checkmark-circle" size={22} color={PURPLE} />
      ) : spinner ? (
        <ActivityIndicator size="small" color={PURPLE} />
      ) : (
        <Ionicons name="ellipse-outline" size={22} color={MUTED} />
      )}
      <Text style={{ color: done ? "#fff" : MUTED, fontWeight: "700", fontSize: 15 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flexCenter: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  capHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  capTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  headerBtn: { padding: 4 },
  sideTools: { width: 48, justifyContent: "center", gap: 16, paddingLeft: 6 },
  sideBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  sideBtnActive: {
    backgroundColor: "rgba(0,229,255,0.15)",
    borderColor: "#00E5FF",
  },
  boomerangIcon: { fontSize: 22, color: "#FFFFFF", fontWeight: "700" },
  boomerangIconActive: { color: "#00E5FF" },
  boomerangIndicator: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,229,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#00E5FF",
  },
  boomerangIndicatorText: {
    color: "#00E5FF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  viewport: { flex: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#111016" },
  viewportEmpty: { justifyContent: "center", alignItems: "center" },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    marginTop: 16,
  },
  thumbBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 60, height: 60, borderRadius: 999, backgroundColor: "#fff" },
  flipBtn: { padding: 8 },
  modeTxtOn: { color: "#fff", fontWeight: "800" },
  modeLine: { height: 2, borderRadius: 2, backgroundColor: PURPLE },
  capNextBig: {
    marginTop: 10,
    marginHorizontal: 20,
    backgroundColor: STORY_BTN,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  capNextTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  previewBox: { borderRadius: 14, overflow: "hidden", width: "100%", backgroundColor: "#000" },
  textOverlay: { position: "absolute", padding: 4 },
  stickerOverlay: { position: "absolute" },
  filterStrip: { maxHeight: 52, marginTop: 10, paddingHorizontal: 12 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  filterPillOn: { backgroundColor: "rgba(123,47,190,0.25)", borderColor: PURPLE },
  filterPillTxt: { color: MUTED, fontWeight: "700", fontSize: 13 },
  toolScroll: { maxHeight: 48, marginTop: 6, paddingHorizontal: 14 },
  topToolChip: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  topToolAa: { color: "#fff", fontSize: 16, fontWeight: "800" },
  editFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  storyAvatarRing: {
    borderWidth: 2,
    borderColor: PURPLE,
    padding: 3,
    borderRadius: 999,
  },
  miniAv: { width: 40, height: 40, borderRadius: 999 },
  miniAvFallback: {
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  editNextPurple: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    gap: 4,
  },
  editNextTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },
  miniPreviewRow: { borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  captionArea: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    color: "#fff",
    padding: 14,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 8,
    fontSize: 15,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  detailRowTxt: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 15 },
  uploadProgress: { paddingHorizontal: 16, marginBottom: 12 },
  progressTrack: {
    height: 3,
    backgroundColor: "#2A1A4A",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: { height: 3, backgroundColor: PURPLE, borderRadius: 2 },
  progressText: { color: MUTED, fontSize: 12, textAlign: "center" },
  shareHugeDisabled: { opacity: 0.6 },
  shareBtnContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  shareHuge: {
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  shareHugeTxt: { color: "#fff", fontWeight: "900", fontSize: 17 },
  ringOuter: {
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 8,
    borderColor: "rgba(123,47,190,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  ringPct: { color: PURPLE, fontSize: 36, fontWeight: "900" },
  postTitle: { color: "#fff", fontWeight: "800", marginTop: 24, fontSize: 17 },
  postSub: { color: MUTED, marginTop: 8, textAlign: "center", paddingHorizontal: 20 },
  lineBarOuter: {
    alignSelf: "stretch",
    height: 4,
    marginTop: 32,
    marginHorizontal: 32,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 4,
    overflow: "hidden",
  },
  lineBarInner: { height: "100%", backgroundColor: PURPLE, borderRadius: 4 },
  helpHint: { color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center" },
  textModalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  textModal: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  textModalTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  textModalInput: {
    fontSize: 20,
    fontWeight: "600",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingVertical: 8,
    marginBottom: 16,
    textAlign: "center",
    minHeight: 60,
    color: "#fff",
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotActive: { borderColor: "#FFFFFF", transform: [{ scale: 1.2 }] },
  fontSizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  fontSizeLabel: { color: MUTED, fontSize: 13 },
  fontSizeBtn: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fontSizeBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  fontSizeValue: { color: "#FFFFFF", fontSize: 15, minWidth: 30, textAlign: "center" },
  boldBtn: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  boldBtnActive: { borderColor: PURPLE, backgroundColor: "#1A0A2E" },
  boldBtnText: { color: MUTED, fontSize: 16, fontWeight: "800" },
  boldBtnTextActive: { color: PURPLE },
  textModalBtns: { flexDirection: "row", gap: 10 },
  textModalCancel: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    alignItems: "center",
  },
  textModalCancelText: { color: MUTED, fontWeight: "600" },
  textModalAdd: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: PURPLE,
    borderRadius: 12,
    alignItems: "center",
  },
  textModalAddText: { color: "#FFFFFF", fontWeight: "700" },
  stickerModalBg: { flex: 1, justifyContent: "flex-end" },
  stickerSheet: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: "#1F1F1F",
  },
  stickerSheetTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  stickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stickerItem: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
  },
  stickerEmoji: { fontSize: 28 },
});
