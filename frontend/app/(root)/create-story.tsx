import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { Video, ResizeMode } from "expo-av";
import { Image } from "expo-image";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/theme";
import { useAuth } from "@/store/auth.store";
import { mediaApi } from "@/utils/media.api";
import { storiesApi } from "@/utils/stories.api";
import {
  deleteStoryDraft,
  getStoryDraft,
  saveStoryDraft,
  type StoryDraftStep,
} from "@/utils/storyDrafts.storage";

const PURPLE = "#A855F7";
const MUTED = "#8E8E93";

const FILTERS = [
  { key: "Normal", tint: null as string | null },
  { key: "Clarendon", tint: "rgba(90, 140, 240, 0.22)" },
  { key: "Gingham", tint: "rgba(255, 230, 210, 0.18)" },
  { key: "Moon", tint: "rgba(40, 55, 95, 0.35)" },
  { key: "Lark", tint: "rgba(255, 255, 235, 0.12)" },
] as const;

type FlowStep = "capture" | "edit" | "details" | "posting";

type PickedMedia = { uri: string; mime: string; kind: "image" | "video" };

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

export default function CreateStoryScreen() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const params = useLocalSearchParams<{ draftId?: string }>();

  const [step, setStep] = useState<FlowStep>("capture");
  const [cameraFace, setCameraFace] = useState<"front" | "back">("back");
  const [modeTab, setModeTab] = useState<"POST" | "STORY" | "LIVE">("STORY");

  const [picked, setPicked] = useState<PickedMedia | null>(null);
  const [filterKey, setFilterKey] = useState<string>("Normal");
  const [overlayText] = useState("Good vibes Only");
  const [caption, setCaption] = useState("");
  const [storyVisibility, setStoryVisibility] = useState("Everyone");
  const [repliesLabel, setRepliesLabel] = useState("Everyone");
  const [draftPersistId, setDraftPersistId] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);

  const [postProgress, setPostProgress] = useState(0);
  const [phases, setPhases] = useState({ up: false, proc: false, pub: false });

  const tint = useMemo(() => FILTERS.find((f) => f.key === filterKey)?.tint ?? null, [filterKey]);

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
      setPicked({ uri: d.localUri, mime: d.mime, kind: d.mediaKind });
      const st: FlowStep =
        d.step === "capture" ? "capture" : d.step === "edit" ? "edit" : "details";
      setStep(st);
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.draftId]);

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
    setPicked({ uri: a.uri, mime, kind });
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
    setPicked({ uri: a.uri, mime, kind });
  };

  const goBack = useCallback(() => {
    if (step === "posting") return;
    if (step === "capture") router.back();
    else if (step === "edit") setStep("capture");
    else if (step === "details") setStep("edit");
  }, [step]);

  const saveDraftAndExit = async () => {
    if (!picked) {
      Alert.alert("Add media", "Capture or choose a photo or video first.");
      return;
    }
    try {
      await persistDraft("details");
      Alert.alert("Draft saved", "Resume from Quick Create → Drafts.");
      router.back();
    } catch {
      Alert.alert("Could not save draft");
    }
  };

  const publishStory = async () => {
    if (!email || !picked) return;
    setStep("posting");
    setPostProgress(12);
    setPhases({ up: false, proc: false, pub: false });
    try {
      const name = picked.uri.split("/").pop() || (picked.kind === "video" ? "story.mp4" : "story.jpg");
      const up = await mediaApi.upload({ uri: picked.uri, name, type: picked.mime });
      const mt = up.resource_type === "video" ? "video" : "image";
      setPostProgress(58);
      setPhases({ up: true, proc: false, pub: false });
      await storiesApi.create({
        author_email: email,
        media_url: up.url,
        media_type: mt,
        caption: caption.trim() || undefined,
      });
      setPostProgress(82);
      setPhases({ up: true, proc: true, pub: false });
      await new Promise((r) => setTimeout(r, 400));
      setPhases({ up: true, proc: true, pub: true });
      setPostProgress(100);
      if (draftPersistId) await deleteStoryDraft(draftPersistId);
      setTimeout(() => router.back(), 480);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      Alert.alert("Could not publish", msg);
      setStep("details");
    }
  };

  const previewVisual = ({ height, fill }: { height: number; fill?: boolean }) => (
    <View style={[styles.previewBox, { height }, fill && { flex: 1 }]}>
      {picked?.kind === "video" ? (
        <Video
          source={{ uri: picked.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isMuted
          shouldPlay={step === "edit"}
          isLooping
        />
      ) : picked ? (
        <Image source={{ uri: picked.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center" }]}>
          <Feather name="aperture" size={42} color="rgba(255,255,255,0.2)" />
        </View>
      )}
      {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
      {picked && overlayText ? (
        <View style={styles.storyOverlayLbl} pointerEvents="none">
          <Text style={styles.storyLbl}>{overlayText}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 }}>
            <Ionicons name="location" size={14} color="white" />
            <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>MOUNTAIN VIEW</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050508" }} edges={["top", "bottom"]}>
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
              <TouchableOpacity
                style={styles.sideBtn}
                onPress={() => Alert.alert("Text", "Coming in a future update.")}
              >
                <Feather name="type" size={22} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sideBtn}
                onPress={() => Alert.alert("Boomerang", "Coming in a future update.")}
              >
                <MaterialCommunityIcons name="infinity" size={26} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sideBtn}
                onPress={() => Alert.alert("Layout", "Coming in a future update.")}
              >
                <Ionicons name="grid-outline" size={22} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sideBtn}
                onPress={() => Alert.alert("Stickers", "Coming in a future update.")}
              >
                <Ionicons name="happy-outline" size={22} color="white" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={[styles.viewport, { minHeight: 320 }]}>
                {picked ? (
                  previewVisual({ height: 380 })
                ) : (
                  <Pressable style={[styles.viewport, { minHeight: 380 }]} onPress={takePhoto}>
                    <View style={[StyleSheet.absoluteFill, styles.viewportEmpty]}>
                      <Text style={{ color: MUTED, textAlign: "center", paddingHorizontal: 24 }}>
                        Open the shutter to capture or pick from gallery. Stories expire after 24 hours.
                      </Text>
                    </View>
                  </Pressable>
                )}
              </View>
              <View style={styles.shutterRow}>
                <TouchableOpacity style={styles.thumbBox} onPress={pickLibrary}>
                  <Ionicons name="images-outline" size={22} color="white" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.shutter} onPress={takePhoto}>
                  <View style={styles.shutterInner} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.flipBtn}
                  onPress={() => setCameraFace((f) => (f === "back" ? "front" : "back"))}
                >
                  <Ionicons name="camera-reverse-outline" size={26} color="white" />
                </TouchableOpacity>
              </View>
              <View style={[styles.modeRow, { paddingBottom: 10 }]}>
                {(["POST", "STORY", "LIVE"] as const).map((m) => (
                  <Pressable key={m} onPress={() => setModeTab(m)} style={{ paddingVertical: 8, paddingHorizontal: 14 }}>
                    <Text style={[styles.modeTxt, modeTab === m && styles.modeTxtOn]}>{m}</Text>
                    {modeTab === m ? <View style={styles.modeLine} /> : <View style={{ height: 2 }} />}
                  </Pressable>
                ))}
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
                <Feather name="chevron-right" size={18} color="#050508" />
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
                  <TouchableOpacity onPress={() => setFilterKey("Normal")} hitSlop={8}>
                    <Ionicons name="arrow-undo-outline" size={22} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => Alert.alert("Save", "Use Next when you are done editing.")} hitSlop={8}>
                    <Ionicons name="download-outline" size={22} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolScroll}>
                {(
                  [
                    { ion: "happy-outline" as const, label: "Stickers" },
                    { ion: "create-outline" as const, label: "Draw" },
                    { ion: "text-outline" as const, label: "Text" },
                  ] as const
                ).map((t) => (
                  <TouchableOpacity key={t.label} style={styles.topToolChip} onPress={() => Alert.alert(t.label)}>
                    <Ionicons name={t.ion} size={20} color="white" />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flex: 1, marginHorizontal: 12 }}>
                {picked ? previewVisual({ height: 420 }) : null}
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
                  <Text style={{ color: "#fff", fontWeight: "800", marginLeft: 10, fontSize: 14 }}>
                    Your Story
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editNextPurple}
                  onPress={async () => {
                    await persistDraft("edit");
                    setStep("details");
                  }}
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
                <View style={[styles.miniPreviewRow, { height: 148 }]}>
                  {picked ? previewVisual({ height: 148 }) : null}
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
                {(["Add location", "Mention people", "Add hashtag"] as const).map((label) => (
                  <TouchableOpacity key={label} style={styles.detailRow} onPress={() => Alert.alert(label)}>
                    <Ionicons name="ellipse-outline" size={20} color={MUTED} />
                    <Text style={styles.detailRowTxt}>{label}</Text>
                    <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() =>
                    Alert.alert("Who can see this story?", "", [
                      { text: "Everyone", onPress: () => setStoryVisibility("Everyone") },
                      { text: "Close friends", onPress: () => setStoryVisibility("Close friends") },
                      { text: "Cancel", style: "cancel" },
                    ])
                  }
                >
                  <Text style={styles.detailRowTxt}>Who can see this story?</Text>
                  <Text style={{ color: PURPLE, fontWeight: "800", fontSize: 14 }}>
                    {storyVisibility} ›
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() =>
                    Alert.alert("Allow replies", "", [
                      { text: "Everyone", onPress: () => setRepliesLabel("Everyone") },
                      {
                        text: "People you follow",
                        onPress: () => setRepliesLabel("People you follow"),
                      },
                      { text: "Off", onPress: () => setRepliesLabel("Off") },
                      { text: "Cancel", style: "cancel" },
                    ])
                  }
                >
                  <Text style={styles.detailRowTxt}>Allow replies</Text>
                  <Text style={{ color: PURPLE, fontWeight: "800", fontSize: 14 }}>
                    {repliesLabel} ›
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.helpHint, { marginTop: 8 }]}>
                  Stories disappear after 24 hours.
                </Text>
                <TouchableOpacity style={styles.shareHuge} activeOpacity={0.92} onPress={publishStory}>
                  <Text style={styles.shareHugeTxt}>Share to Story</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: "center", paddingVertical: 14 }} onPress={saveDraftAndExit}>
                  <Text style={{ color: PURPLE, fontWeight: "800", fontSize: 15 }}>Save Draft</Text>
                </TouchableOpacity>
              </ScrollView>
            </>
          )}
        </KeyboardAvoidingView>
      )}
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
  sideTools: { width: 48, justifyContent: "center", gap: 16, paddingLeft: 6 },
  sideBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
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
  modeRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 14 },
  modeTxt: { color: MUTED, fontWeight: "800", fontSize: 12 },
  modeTxtOn: { color: "#fff" },
  modeLine: { height: 2, marginTop: 6, borderRadius: 2, backgroundColor: PURPLE },
  capNextBig: {
    marginTop: 10,
    marginHorizontal: 20,
    backgroundColor: PURPLE,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  capNextTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },
  previewBox: { borderRadius: 14, overflow: "hidden", width: "100%", backgroundColor: "#000" },
  storyOverlayLbl: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },
  storyLbl: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  filterStrip: { maxHeight: 52, marginTop: 10, paddingHorizontal: 12 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  filterPillOn: { backgroundColor: "rgba(168,85,247,0.35)", borderWidth: 1, borderColor: PURPLE },
  filterPillTxt: { color: MUTED, fontWeight: "700", fontSize: 13 },
  toolScroll: { maxHeight: 48, marginTop: 6, paddingHorizontal: 14 },
  topToolChip: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
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
    backgroundColor: PURPLE,
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
  shareHuge: {
    marginTop: 20,
    backgroundColor: PURPLE,
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
    borderColor: "rgba(168,85,247,0.35)",
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
});
