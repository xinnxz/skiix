import React, { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Colors } from "@/theme";
import { useAuth } from "@/store/auth.store";
import { mediaApi } from "@/utils/media.api";
import { publicPostsApi } from "@/utils/publicPosts.api";
import {
  deleteReelDraft,
  getReelDraft,
  saveReelDraft,
  type ReelDraftStep,
} from "@/utils/reelDrafts.storage";

type FlowStep = "select" | "edit" | "details" | "posting";

type Picked = { uri: string; mime: string };

function guessMime(uri: string, fallback: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  return fallback || "video/mp4";
}

const ACCENT = "#00E5FF";
const MUTED = "#8E8E93";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

const EDIT_REEL_TOOLS: { icon: FeatherIconName; label: string }[] = [
  { icon: "volume-2", label: "Audio" },
  { icon: "type", label: "Text" },
  { icon: "smile", label: "Stickers" },
  { icon: "sliders", label: "Filters" },
  { icon: "sun", label: "Adjust" },
  { icon: "zap", label: "Speed" },
];

export default function CreateReelScreen() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const params = useLocalSearchParams<{ draftId?: string }>();

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

  const videoRef = useRef<Video | null>(null);
  const [playing, setPlaying] = useState(false);
  const [editStatus, setEditStatus] = useState<AVPlaybackStatus | null>(null);

  const canProceedSelect = !!picked?.uri;

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
    if (!email) {
      Alert.alert("Sign in required", "You need an account to post.");
      return;
    }
    if (!picked?.uri) return;
    setStep("posting");
    setPostProgress(12);
    setPostPhaseDone({ upload: false, process: false, done: false });
    try {
      const name = picked.uri.split("/").pop() || "reel.mp4";
      const up = await mediaApi.upload({ uri: picked.uri, name, type: picked.mime });
      if (up.resource_type !== "video") {
        throw new Error("Upload must be a video file.");
      }
      setPostProgress(55);
      setPostPhaseDone((p) => ({ ...p, upload: true }));
      await publicPostsApi.create({
        author_email: email,
        type: "reel",
        content: composeContent.trim(),
        media_url: up.url,
      });
      setPostProgress(82);
      setPostPhaseDone((p) => ({ ...p, process: true }));
      await new Promise((r) => setTimeout(r, 420));
      setPostPhaseDone({ upload: true, process: true, done: true });
      setPostProgress(100);
      if (draftPersistId) await deleteReelDraft(draftPersistId);
      setTimeout(() => router.back(), 520);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      Alert.alert("Post failed", msg);
      setStep("details");
    }
  };

  const { height: winH } = Dimensions.get("window");
  const editVideoHeight = Math.max(420, Math.floor(winH * 0.58));

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
                onPress={() => setStep("edit")}
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
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <View style={styles.mediaBar}>
                <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>Library</Text>
                <TouchableOpacity activeOpacity={0.85} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: ACCENT, fontWeight: "700", fontSize: 14 }}>Recent</Text>
                  <Feather name="chevron-down" size={14} color={ACCENT} />
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

              <TouchableOpacity
                onPress={pickVideo}
                activeOpacity={0.9}
                style={styles.pickZone}
              >
                {picked ? (
                  <Video
                    source={{ uri: picked.uri }}
                    style={{ width: "100%", height: 380 }}
                    resizeMode={ResizeMode.COVER}
                    isMuted
                    shouldPlay={false}
                  />
                ) : (
                  <View style={styles.pickInner}>
                    <Ionicons name="videocam-outline" size={40} color={ACCENT} />
                    <Text style={styles.pickTitle}>Choose a video</Text>
                    <Text style={styles.pickSub}>Your reel will publish as a vertical clip.</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.footerSel}>
                <Text style={{ color: MUTED, fontSize: 13 }}>
                  {picked ? "1 selected" : "No selection"}
                </Text>
                <TouchableOpacity
                  onPress={() => setStep("edit")}
                  disabled={!canProceedSelect}
                  style={[styles.nextCta, !canProceedSelect && { opacity: 0.35 }]}
                >
                  <Text style={styles.nextCtaTxt}>Next</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {step === "details" && (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 44 }}>
              <View style={{ flexDirection: "row", gap: 14 }}>
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
                  {picked ? (
                  <Video
                    source={{ uri: picked.uri }}
                    style={{ flex: 1 }}
                    resizeMode={ResizeMode.COVER}
                    isMuted
                    shouldPlay={false}
                  />
                  ) : null}
                  <View style={styles.coverOverlay}>
                    <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>Edit Cover</Text>
                  </View>
                </View>
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
              />
              <TextInput
                value={hashtags}
                onChangeText={setHashtags}
                placeholder="# Add hashtags"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.input}
                autoCapitalize="none"
              />

              {(["Tag people", "Add collaborators", "Add location"] as const).map((label) => (
                <TouchableOpacity key={label} activeOpacity={0.75} style={styles.detailRow}>
                  <Ionicons name="person-outline" size={20} color={MUTED} />
                  <Text style={styles.detailRowTxt}>{label}</Text>
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity activeOpacity={0.75} style={styles.detailRow}>
                <Ionicons name="globe-outline" size={20} color={MUTED} />
                <Text style={styles.detailRowTxt}>Audience</Text>
                <Text style={[styles.detailRowTxt, { flex: 0, opacity: 0.45 }]}>Everyone</Text>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>

              <Text style={styles.shareLabel}>Also share to</Text>
              <View style={styles.shareRow}>
                <Text style={styles.shareRowTxt}>Skiix Feed</Text>
                <Switch value={shareFeed} onValueChange={setShareFeed} trackColor={{ false: "#333", true: ACCENT }} />
              </View>
              <View style={styles.shareRow}>
                <Text style={styles.shareRowTxt}>Your Profile</Text>
                <Switch
                  value={shareProfile}
                  onValueChange={setShareProfile}
                  trackColor={{ false: "#333", true: ACCENT }}
                />
              </View>

              <TouchableOpacity style={styles.shareReelBtn} onPress={publishReel} activeOpacity={0.92}>
                <Text style={styles.shareReelBtnTxt}>Share Reel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: "center", paddingVertical: 14 }} onPress={persistDraftDetails}>
                <Text style={{ color: ACCENT, fontWeight: "800", fontSize: 15 }}>Save Draft</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      )}

      {step === "edit" && picked && (
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
            <View style={{ flex: 1, height: editVideoHeight, alignSelf: "center", width: "100%" }}>
              <Video
                ref={(r) => {
                  videoRef.current = r;
                }}
                source={{ uri: picked.uri }}
                style={{ flex: 1, backgroundColor: "#000" }}
                resizeMode={ResizeMode.CONTAIN}
                isLooping
                onPlaybackStatusUpdate={(st) => {
                  if (st.isLoaded) setEditStatus(st);
                }}
                shouldPlay={false}
              />
            </View>
            <View style={styles.editTools}>
              {EDIT_REEL_TOOLS.map((t) => (
                <TouchableOpacity
                  key={t.label}
                  style={styles.toolBtn}
                  onPress={() => Alert.alert(t.label, "Fine controls are coming soon.")}
                >
                  <Feather name={t.icon} size={20} color="white" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.editBottom}>
            <TouchableOpacity style={styles.playFab} onPress={togglePlayback}>
              <Feather name={playing ? "pause" : "play"} size={22} color="#000" />
            </TouchableOpacity>
            <Text style={{ color: MUTED, fontSize: 12 }}>
              Trim & effects are preview-only for now — full editor ships next.
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
  editTools: { width: 48, justifyContent: "center", gap: 14, paddingRight: 6 },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
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
