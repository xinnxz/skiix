import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Colors } from "@/theme";
import { useAuth } from "@/store/auth.store";
import { publicPostsApi } from "@/utils/publicPosts.api";
import { deleteTextDraft, getTextDraft, saveTextDraft, type TextDraftStep } from "@/utils/textDrafts.storage";

const ACCENT = "#00E5FF";
const MUTED = "#8E8E93";

type FlowStep = "compose" | "details" | "review" | "posting";

function stepToPersist(s: Exclude<FlowStep, "posting">): TextDraftStep {
  return s;
}

export default function TextPostScreen() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const params = useLocalSearchParams<{ draftId?: string }>();

  const [step, setStep] = useState<FlowStep>("compose");
  const [body, setBody] = useState("");
  const [replyPrivacyLabel, setReplyPrivacyLabel] = useState("Everyone can reply");
  const [visibility, setVisibility] = useState("Public");
  const [allowComments, setAllowComments] = useState(true);
  const [allowShares, setAllowShares] = useState(true);
  const [saveAsDraftPreferred, setSaveAsDraftPreferred] = useState(false);
  const [draftPersistId, setDraftPersistId] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);

  const [postProgress, setPostProgress] = useState(0);
  const [postPhases, setPostPhases] = useState({ prep: false, publish: false, done: false });

  const displayName = user?.display_name?.trim() || user?.username || "You";

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
      const d = await getTextDraft(id);
      if (cancelled) return;
      if (!d) {
        setHydrating(false);
        Alert.alert("Draft not found", "This draft may have been deleted.");
        return;
      }
      setDraftPersistId(d.id);
      setBody(d.body);
      setAllowComments(d.allowComments);
      setAllowShares(d.allowShares);
      const mapped: FlowStep =
        d.step === "compose" ? "compose" : d.step === "details" ? "details" : "review";
      setStep(mapped);
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.draftId]);

  const canComposeNext = body.trim().length > 0;
  const displayBody = body.trim();

  const persistCurrent = async (s: Exclude<FlowStep, "posting">) =>
    saveTextDraft({
      id: draftPersistId ?? undefined,
      body,
      step: stepToPersist(s),
      allowComments,
      allowShares,
    }).then((row) => {
      setDraftPersistId(row.id);
      return row;
    });

  const goBackWithinFlow = useCallback(async () => {
    if (step === "compose") router.back();
    else if (step === "details") setStep("compose");
    else if (step === "review") setStep("details");
  }, [step]);

  const composeClose = () => {
    if (body.trim().length === 0) {
      router.back();
      return;
    }
    Alert.alert("Discard post?", "You can save a draft from the Review screen first.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => router.back(),
      },
    ]);
  };

  const insertSnippet = useCallback((fn: (t: string) => string) => {
    setBody((t) => fn(t));
  }, []);

  const toolbar = (
    <>
      <View style={composeStyles.metaBar}>
        {(
          [
            { icon: "image-outline", label: "Photo" },
            { icon: "flash-outline", label: "Gif" },
            { icon: "happy-outline", label: "Emoji" },
            { icon: "location-outline", label: "Location" },
          ] as const
        ).map((m) => (
          <TouchableOpacity
            key={m.label}
            style={composeStyles.metaIcon}
            onPress={() =>
              Alert.alert(m.label, "Attach here soon — composing still works.")
            }
          >
            <Ionicons name={m.icon} size={22} color={MUTED} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={composeStyles.formatBar}>
        <TouchableOpacity
          style={composeStyles.fmtBtn}
          onPress={() => Alert.alert("Text style", "Rich styles are coming soon.")}
        >
          <Text style={composeStyles.fmtAa}>Aa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={composeStyles.fmtBtn}
          onPress={() =>
            insertSnippet((t) => {
              const s = t.replace(/\s*$/, "");
              return s === "" ? "#" : `${s} #`;
            })
          }
        >
          <Ionicons name="pricetag-outline" size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          style={composeStyles.fmtBtn}
          onPress={() => Alert.alert("Poll", "Polls will be available in an upcoming update.")}
        >
          <Ionicons name="bar-chart-outline" size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          style={composeStyles.fmtBtn}
          onPress={() =>
            insertSnippet((t) => {
              const s = t.replace(/\s*$/, "");
              return s === "" ? "> " : `${s}\n> `;
            })
          }
        >
          <Ionicons name="quote-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </>
  );

  const runSaveDeviceDraft = async () => {
    try {
      await persistCurrent("review");
      Alert.alert("Draft saved", "Open Quick Create → Drafts to resume.");
      router.back();
    } catch {
      Alert.alert("Could not save draft", "Try again.");
    }
  };

  const publish = async () => {
    if (saveAsDraftPreferred) {
      await runSaveDeviceDraft();
      return;
    }
    if (!email || !displayBody) return;
    setStep("posting");
    setPostProgress(14);
    setPostPhases({ prep: false, publish: false, done: false });
    try {
      await new Promise((r) => setTimeout(r, 220));
      setPostProgress(35);
      setPostPhases((p) => ({ ...p, prep: true }));
      await publicPostsApi.create({
        author_email: email,
        type: "text",
        content: displayBody,
        media_url: null,
      });
      setPostProgress(72);
      setPostPhases((p) => ({ ...p, publish: true }));
      await new Promise((r) => setTimeout(r, 350));
      setPostPhases({ prep: true, publish: true, done: true });
      setPostProgress(100);
      if (draftPersistId) await deleteTextDraft(draftPersistId);
      setTimeout(() => router.back(), 480);
    } catch {
      Alert.alert("Post failed", "Check your connection and try again.");
      setStep("review");
    }
  };

  const reviewPrimaryLabel = saveAsDraftPreferred ? "Save draft" : "Post";

  const subtitlePostText = useMemo(
    () => (saveAsDraftPreferred ? "Saving to this device instead of publishing." : "Review before you share."),
    [saveAsDraftPreferred],
  );

  if (hydrating) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgBlack, justifyContent: "center" }}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={{ color: MUTED, textAlign: "center", marginTop: 12 }}>Loading draft…</Text>
      </SafeAreaView>
    );
  }

  if (step === "posting") {
    return (
      <SafeAreaView style={[postStyles.wrap, { backgroundColor: Colors.bgBlack }]} edges={["top", "bottom"]}>
        <Ionicons name="paper-plane" size={56} color={ACCENT} style={{ marginBottom: 8 }} />
        <Text style={postStyles.pct}>{Math.round(postProgress)}%</Text>
        <Text style={postStyles.msg}>{"Posting your text… Please don't close the app."}</Text>
        <View style={postStyles.list}>
          <CheckRow done={postPhases.prep} label="Preparing" spinner={!postPhases.prep && postProgress > 0} />
          <CheckRow done={postPhases.publish} label="Publishing" spinner={postPhases.prep && !postPhases.publish} />
          <CheckRow done={postPhases.done} label="Finalizing" spinner={postPhases.publish && !postPhases.done} />
        </View>
        <View style={postStyles.barOuter}>
          <View style={[postStyles.barInner, { width: `${Math.min(100, postProgress)}%` }]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgBlack }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {step === "compose" ? (
          <>
            <View style={composeStyles.header}>
              <TouchableOpacity onPress={composeClose} hitSlop={12}>
                <Ionicons name="close" size={26} color="white" />
              </TouchableOpacity>
              <Text style={composeStyles.headerTitle}>New Text Post</Text>
              <TouchableOpacity
                disabled={!canComposeNext}
                style={[composeStyles.hdrPill, !canComposeNext && { opacity: 0.38 }]}
                onPress={() => {
                  void persistCurrent("compose").catch(() => undefined);
                  setStep("details");
                }}
              >
                <Text style={composeStyles.hdrPillTxt}>Next</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 36 }}
              style={{ flex: 1 }}
            >
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={"What's on your mind?"}
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={composeStyles.mainInput}
                multiline
                textAlignVertical="top"
                maxLength={2800}
              />
              {toolbar}
            </ScrollView>
          </>
        ) : null}

        {step === "details" ? (
          <>
            <View style={composeStyles.headerAlt}>
              <TouchableOpacity onPress={goBackWithinFlow} hitSlop={12}>
                <Ionicons name="chevron-back" size={26} color="white" />
              </TouchableOpacity>
              <Text style={composeStyles.headerTitle}>Add details</Text>
              <TouchableOpacity
                disabled={!canComposeNext}
                style={[composeStyles.hdrPill, !canComposeNext && { opacity: 0.38 }]}
                onPress={async () => {
                  await persistCurrent("review");
                  setStep("review");
                }}
              >
                <Text style={composeStyles.hdrPillTxt}>Next</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 44 }}>
              <View style={detailStyles.previewCard}>
                <Text style={{ color: "#fff", fontSize: 16, lineHeight: 23 }}>{displayBody || "…"}</Text>
              </View>
              <TouchableOpacity
                style={detailStyles.row}
                onPress={() => Alert.alert("Location", "Location tagging arrives in a future build.")}
              >
                <Ionicons name="location-outline" size={22} color={MUTED} />
                <Text style={detailStyles.rowTxt}>Add location</Text>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <TouchableOpacity
                style={detailStyles.row}
                onPress={() => Alert.alert("Poll", "Polls will be available in an upcoming update.")}
              >
                <Ionicons name="stats-chart-outline" size={22} color={MUTED} />
                <View style={{ flex: 1 }}>
                  <Text style={detailStyles.rowTxt}>Add poll</Text>
                  <Text style={detailStyles.rowHint}>Ask a question</Text>
                </View>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <TouchableOpacity style={detailStyles.row} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <Text style={[detailStyles.rowTxt]}>Privacy</Text>
                  <Text style={[detailStyles.rowHint, { marginTop: 2 }]}>{replyPrivacyLabel}</Text>
                </View>
                <TouchableOpacity onPress={() => Alert.alert(
                  "Who can reply?",
                  "",
                  [
                    { text: "Everyone", onPress: () => setReplyPrivacyLabel("Everyone can reply") },
                    {
                      text: "People you follow",
                      onPress: () => setReplyPrivacyLabel("People you follow can reply"),
                    },
                    {
                      text: "Mentions only",
                      onPress: () => setReplyPrivacyLabel("Only people you mention can reply"),
                    },
                    { text: "Cancel", style: "cancel" },
                  ],
                )}
                >
                  <Text style={{ color: ACCENT, fontWeight: "800", fontSize: 14 }}>Change &gt;</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </ScrollView>
          </>
        ) : null}

        {step === "review" ? (
          <>
            <View style={composeStyles.headerAlt}>
              <TouchableOpacity onPress={goBackWithinFlow} hitSlop={12}>
                <Text style={{ color: ACCENT, fontWeight: "800", fontSize: 15 }}>{"< Back"}</Text>
              </TouchableOpacity>
              <Text style={composeStyles.headerTitle}>Review</Text>
              <TouchableOpacity style={composeStyles.hdrPill} onPress={publish}>
                <Text style={composeStyles.hdrPillTxt}>{reviewPrimaryLabel}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 48 }}>
              <Text style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>{subtitlePostText}</Text>
              <View style={detailStyles.previewProfile}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={detailStyles.avatar} contentFit="cover" />
                ) : (
                  <View style={[detailStyles.avatar, { backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center" }]}>
                    <Ionicons name="person-outline" size={26} color="white" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>{displayName}</Text>
                  <View style={{ alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "rgba(0,229,255,0.35)" }}>
                    <Text style={{ color: ACCENT, fontSize: 11, fontWeight: "900" }}>
                      PUBLIC
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[detailStyles.previewCard, { marginTop: 16 }]}>
                <Text style={{ color: "#fff", fontSize: 16, lineHeight: 24 }}>{displayBody}</Text>
              </View>

              <TouchableOpacity
                style={detailStyles.row}
                activeOpacity={0.85}
                onPress={() => Alert.alert(
                  "Who can see this?",
                  "",
                  [
                    { text: "Public", onPress: () => setVisibility("Public") },
                    { text: "Followers", onPress: () => setVisibility("Followers") },
                    { text: "Only you", onPress: () => setVisibility("Only you") },
                    { text: "Cancel", style: "cancel" },
                  ],
                )}
              >
                <Text style={detailStyles.rowTxt}>Who can see this?</Text>
                <Text style={{ color: MUTED, fontWeight: "700", fontSize: 14 }}>
                  {visibility} <Text style={{ color: ACCENT }}>&gt;</Text>
                </Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Allow comments</Text>
                <Switch value={allowComments} onValueChange={setAllowComments} trackColor={{ false: "#333", true: ACCENT }} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Allow shares</Text>
                <Switch value={allowShares} onValueChange={setAllowShares} trackColor={{ false: "#333", true: ACCENT }} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Save as draft</Text>
                <Switch value={saveAsDraftPreferred} onValueChange={setSaveAsDraftPreferred} trackColor={{ false: "#333", true: ACCENT }} />
              </View>

              <TouchableOpacity style={[composeStyles.shareBig, saveAsDraftPreferred && { borderWidth: 1, borderColor: ACCENT, backgroundColor: "transparent" }]} activeOpacity={0.92} onPress={publish}>
                <Text style={[composeStyles.shareBigTxt, saveAsDraftPreferred && { color: ACCENT }]}>
                  {reviewPrimaryLabel}
                </Text>
              </TouchableOpacity>
              {!saveAsDraftPreferred ? (
                <TouchableOpacity
                  style={{ alignItems: "center", paddingTop: 12 }}
                  onPress={async () => {
                    await persistCurrent("review");
                    Alert.alert("Draft saved.");
                  }}
                >
                  <Text style={{ color: ACCENT, fontWeight: "800" }}>Save draft without leaving</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
      <Text style={{ color: done ? "#fff" : MUTED, fontWeight: "700", fontSize: 15 }}>{label}</Text>
    </View>
  );
}

const composeStyles = {
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerAlt: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: { flex: 1, textAlign: "center" as const, color: "white", fontSize: 16, fontWeight: "800" as const },
  hdrPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  hdrPillTxt: { color: "#000", fontWeight: "900" as const, fontSize: 15 },
  mainInput: {
    minHeight: 180,
    fontSize: 17,
    lineHeight: 25,
    color: "white" as const,
    marginBottom: 12,
    paddingVertical: 4,
  },
  metaBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingVertical: 8,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  metaIcon: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  formatBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-around" as const,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  fmtBtn: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, paddingVertical: 6 },
  fmtAa: { color: "#fff", fontWeight: "800" as const, fontSize: 18 },
  shareBig: {
    marginTop: 24,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center" as const,
  },
  shareBigTxt: { color: "#000", fontWeight: "900" as const, fontSize: 17 },
};

const detailStyles = {
  previewCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    marginBottom: 8,
  },
  previewProfile: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center" as const,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowTxt: { flex: 1, color: "#fff", fontWeight: "700" as const, fontSize: 15 },
  rowHint: { color: MUTED, fontSize: 12 },
};

const postStyles = {
  wrap: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, padding: 28 },
  pct: { color: ACCENT, fontWeight: "900" as const, fontSize: 36, marginTop: 8 },
  msg: {
    color: "white",
    fontWeight: "800" as const,
    marginTop: 16,
    textAlign: "center" as const,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  list: { marginTop: 28, gap: 16, alignSelf: "stretch" as const, paddingHorizontal: 24 },
  barOuter: {
    alignSelf: "stretch" as const,
    marginTop: 32,
    height: 4,
    marginHorizontal: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 4,
    overflow: "hidden" as const,
  },
  barInner: { height: "100%" as const, backgroundColor: ACCENT, borderRadius: 4 },
};
