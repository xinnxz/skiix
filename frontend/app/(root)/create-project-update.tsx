import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { Image } from "expo-image";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Colors } from "@/theme";
import { useAuth } from "@/store/auth.store";
import { mediaApi } from "@/utils/media.api";
import { projectsApi } from "@/utils/projects.api";
import { publicPostsApi } from "@/utils/publicPosts.api";
import {
  deleteProjectUpdateDraft,
  getProjectUpdateDraft,
  saveProjectUpdateDraft,
  type ProjectUpdateDraftStep,
} from "@/utils/projectUpdateDrafts.storage";

const GREEN = "#22C55E";
const MUTED = "#8E8E93";

type Project = { id: string; content: string; created_at: string };
type FlowStep = "select" | "write" | "details" | "review" | "posting";

function guessMime(uri: string, fallback: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return fallback || "image/jpeg";
}

function buildPublishedContent(p: {
  body: string;
  tags: string[];
  milestonesEnabled: boolean;
  milestones: string[];
  pollEnabled: boolean;
  pollQuestion: string;
  pollOptions: string[];
}) {
  let c = p.body.trim();
  const tags = p.tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).filter(Boolean);
  if (tags.length) c += `\n\n${tags.join(" ")}`;
  const ms = p.milestonesEnabled ? p.milestones.map((m) => m.trim()).filter(Boolean) : [];
  if (ms.length) c += `\n\n📌 Milestones\n${ms.join("\n")}`;
  if (p.pollEnabled && p.pollQuestion.trim()) {
    const opts = p.pollOptions.map((o) => o.trim()).filter(Boolean);
    c += `\n\n📊 ${p.pollQuestion.trim()}`;
    if (opts.length) c += `\n${opts.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
  }
  return c;
}

export default function ProjectUpdateScreen() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const params = useLocalSearchParams<{ draftId?: string }>();

  const [step, setStep] = useState<FlowStep>("select");
  const [hydrating, setHydrating] = useState(false);
  const [draftPersistId, setDraftPersistId] = useState<string | null>(null);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [newProjectName, setNewProjectName] = useState("");

  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [milestonesEnabled, setMilestonesEnabled] = useState(false);
  const [milestones, setMilestones] = useState<string[]>([""]);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("What should we focus on next?");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const [localMediaUri, setLocalMediaUri] = useState<string | null>(null);
  const [localMediaMime, setLocalMediaMime] = useState<string | null>(null);

  const [visibility, setVisibility] = useState("Everyone");

  const [postProgress, setPostProgress] = useState(0);
  const [phases, setPhases] = useState({
    upload: false,
    save: false,
    notify: false,
    pub: false,
  });

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => (p.content || "").toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const projectTitle = selectedLabel || newProjectName.trim() || "Project";

  const persistAt = useCallback(
    async (persistedStep: ProjectUpdateDraftStep) => {
      const row = await saveProjectUpdateDraft({
        id: draftPersistId ?? undefined,
        step: persistedStep,
        selectedProjectId: selectedId,
        selectedProjectLabel: selectedLabel,
        newProjectName,
        searchQuery,
        body,
        tags,
        milestonesEnabled,
        milestones,
        pollEnabled,
        pollQuestion,
        pollOptions,
        localMediaUri,
        localMediaMime,
        visibility,
      });
      setDraftPersistId(row.id);
      return row;
    },
    [
      draftPersistId,
      selectedId,
      selectedLabel,
      newProjectName,
      searchQuery,
      body,
      tags,
      milestonesEnabled,
      milestones,
      pollEnabled,
      pollQuestion,
      pollOptions,
      localMediaUri,
      localMediaMime,
      visibility,
    ],
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!email) {
        setProjects([]);
        setLoadingProjects(false);
        return;
      }
      setLoadingProjects(true);
      try {
        const list = await projectsApi.listMyProjects(email.toLowerCase());
        if (!mounted) return;
        setProjects(list);
      } catch {
        if (!mounted) return;
        setProjects([]);
      } finally {
        if (mounted) setLoadingProjects(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [email]);

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
      const d = await getProjectUpdateDraft(id);
      if (cancelled) return;
      if (!d) {
        setHydrating(false);
        Alert.alert("Draft not found");
        return;
      }
      setDraftPersistId(d.id);
      setStep(d.step === "review" ? "review" : d.step === "details" ? "details" : d.step === "write" ? "write" : "select");
      setSelectedId(d.selectedProjectId);
      setSelectedLabel(d.selectedProjectLabel);
      setNewProjectName(d.newProjectName);
      setSearchQuery(d.searchQuery);
      setBody(d.body);
      setTags(d.tags?.length ? d.tags : []);
      setMilestonesEnabled(d.milestonesEnabled);
      setMilestones(d.milestones?.length ? d.milestones : [""]);
      setPollEnabled(d.pollEnabled);
      setPollQuestion(d.pollQuestion || "");
      setPollOptions(d.pollOptions?.length ? d.pollOptions : ["", ""]);
      setLocalMediaUri(d.localMediaUri);
      setLocalMediaMime(d.localMediaMime);
      setVisibility(d.visibility || "Everyone");
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.draftId]);

  const ensureProjectId = async (): Promise<string> => {
    if (selectedId) return selectedId;
    const name = newProjectName.trim();
    if (!name) throw new Error("Select a project or enter a new project name.");
    const root = await publicPostsApi.create({
      author_email: email,
      type: "project",
      content: name,
      media_url: null,
      project_id: null,
    });
    return root.id;
  };

  const canNextSelect = selectedId !== null || newProjectName.trim().length > 0;

  const canNextWrite = body.trim().length > 0;

  const goBack = () => {
    if (step === "posting") return;
    if (step === "select") router.back();
    else if (step === "write") setStep("select");
    else if (step === "details") setStep("write");
    else if (step === "review") setStep("details");
  };

  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow Photos to attach media.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
    });
    if (r.canceled) return;
    const a = r.assets?.[0];
    if (!a?.uri) return;
    setLocalMediaMime(guessMime(a.uri, a.mimeType ?? "image/jpeg"));
    setLocalMediaUri(a.uri);
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#+/, "");
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const publish = async () => {
    if (!email) {
      Alert.alert("Sign in required");
      return;
    }
    const composed = buildPublishedContent({
      body,
      tags,
      milestonesEnabled,
      milestones,
      pollEnabled,
      pollQuestion,
      pollOptions,
    });
    if (!composed.trim()) return;

    setStep("posting");
    setPostProgress(8);
    setPhases({ upload: false, save: false, notify: false, pub: false });
    try {
      let mediaUrl: string | null = null;
      if (localMediaUri && localMediaMime) {
        const name = localMediaUri.split("/").pop() || "attach.jpg";
        const up = await mediaApi.upload({ uri: localMediaUri, name, type: localMediaMime });
        mediaUrl = up.url;
      }
      setPostProgress(38);
      setPhases((p) => ({ ...p, upload: true }));

      const projectId = await ensureProjectId();
      setPostProgress(58);
      setPhases((p) => ({ ...p, save: true }));

      await publicPostsApi.create({
        author_email: email,
        type: "project",
        content: composed,
        media_url: mediaUrl,
        project_id: projectId,
      });
      setPostProgress(74);
      setPhases((p) => ({ ...p, notify: true }));
      await new Promise((r) => setTimeout(r, 400));
      setPostProgress(92);
      setPhases((p) => ({ ...p, pub: true }));
      await new Promise((r) => setTimeout(r, 350));
      setPostProgress(100);
      if (draftPersistId) await deleteProjectUpdateDraft(draftPersistId);
      setTimeout(() => router.back(), 500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      Alert.alert("Could not publish", msg);
      setStep("review");
    }
  };

  const saveDraftExit = async () => {
    try {
      await persistAt("review");
      Alert.alert("Draft saved", "Open Quick Create → Drafts to continue.");
      router.back();
    } catch {
      Alert.alert("Could not save draft");
    }
  };

  if (hydrating) {
    return (
      <SafeAreaView style={styles.flexCenter}>
        <ActivityIndicator color={GREEN} size="large" />
        <Text style={{ color: MUTED, marginTop: 12 }}>Loading draft…</Text>
      </SafeAreaView>
    );
  }

  if (step === "posting") {
    return (
      <SafeAreaView style={[styles.flexCenter, { padding: 28 }]} edges={["top", "bottom"]}>
        <Ionicons name="rocket" size={52} color={GREEN} />
        <Text style={styles.postTitle}>Publishing your update…</Text>
        <Text style={styles.postSub}>{"Please don't close the app."}</Text>
        <View style={styles.chkCol}>
          <RowChk done={phases.upload} label="Uploading media" spinner={!phases.upload && postProgress > 6} />
          <RowChk done={phases.save} label="Saving update" spinner={phases.upload && !phases.save} />
          <RowChk done={phases.notify} label="Notifying team" spinner={phases.save && !phases.notify} />
          <RowChk done={phases.pub} label="Publishing" spinner={phases.notify && !phases.pub} />
        </View>
        <Text style={[styles.pct, { marginTop: 20 }]}>{Math.round(postProgress)}%</Text>
        <View style={styles.barOut}>
          <View style={[styles.barIn, { width: `${Math.min(100, postProgress)}%` }]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgBlack }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {step === "select" ? (
          <>
            <Header
              title="Select Project"
              onBack={() => router.back()}
              right={null}
            />
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
              <View style={styles.searchWrap}>
                <Feather name="search" size={18} color={MUTED} style={{ marginRight: 10 }} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search projects"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.searchInput}
                />
              </View>
              {loadingProjects ? (
                <ActivityIndicator style={{ marginTop: 28 }} color={GREEN} />
              ) : filteredProjects.length === 0 ? (
                <Text style={{ color: MUTED, marginTop: 24, textAlign: "center" }}>
                  No projects match. Create a new one below.
                </Text>
              ) : (
                filteredProjects.map((p) => {
                  const active = selectedId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.88}
                      onPress={() => {
                        setSelectedId(p.id);
                        setSelectedLabel(p.content || "Project");
                        setNewProjectName("");
                      }}
                      style={[styles.projRow, active && styles.projRowActive]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.projName}>{p.content || "Untitled project"}</Text>
                        <Text style={styles.projDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
                      </View>
                      <View style={[styles.radio, active && styles.radioOn]}>
                        {active ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
              <Text style={styles.secLabel}>Or start a new project</Text>
              <TextInput
                value={newProjectName}
                onChangeText={(t) => {
                  setNewProjectName(t);
                  if (t.trim()) {
                    setSelectedId(null);
                    setSelectedLabel("");
                  }
                }}
                placeholder="New project name…"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.singleInput}
              />
            </ScrollView>
            <View style={styles.footerPad}>
              <TouchableOpacity
                disabled={!canNextSelect}
                style={[styles.btnGreen, !canNextSelect && { opacity: 0.38 }]}
                onPress={async () => {
                  await persistAt("write");
                  setStep("write");
                }}
              >
                <Text style={styles.btnGreenTxt}>Next</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {step === "write" ? (
          <>
            <Header
              title="Project Update"
              onBack={goBack}
              right={
                <TouchableOpacity
                  disabled={!canNextWrite}
                  style={{ opacity: canNextWrite ? 1 : 0.38 }}
                  onPress={async () => {
                    await persistAt("details");
                    setStep("details");
                  }}
                >
                  <Text style={{ color: GREEN, fontWeight: "900", fontSize: 16 }}>Next</Text>
                </TouchableOpacity>
              }
            />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
              <View style={styles.ctxChip}>
                <Ionicons name="cube-outline" size={20} color={GREEN} />
                <Text style={styles.ctxChipTxt} numberOfLines={1}>
                  {projectTitle}
                </Text>
              </View>
              <Text style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>
                {body.trim().length}/1500
              </Text>
              <TextInput
                value={body}
                onChangeText={(t) => setBody(t.slice(0, 1500))}
                placeholder={"What's new with your project?"}
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.bigInput}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.toolRow}>
                <ToolIcon feather="type" onPress={() => Alert.alert("Formatting", "Rich text soon.")} />
                <ToolIcon feather="image" onPress={pickMedia} />
                <ToolIcon ion="bar-chart-outline" onPress={() => Alert.alert("Poll", "Add options in the next step.")} />
                <ToolIcon ion="flag-outline" onPress={() => Alert.alert("Milestone", "Tag milestones in Add details.")} />
              </View>
              {localMediaUri ? (
                <View style={{ marginTop: 12, borderRadius: 12, overflow: "hidden", height: 140 }}>
                  <Image source={{ uri: localMediaUri }} style={{ flex: 1 }} contentFit="cover" />
                  <TouchableOpacity style={styles.stripMedia} onPress={() => {
                    setLocalMediaUri(null);
                    setLocalMediaMime(null);
                  }}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Remove attachment</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>
          </>
        ) : null}

        {step === "details" ? (
          <>
            <Header
              title="Add Details"
              onBack={goBack}
              right={
                <TouchableOpacity
                  onPress={async () => {
                    await persistAt("review");
                    setStep("review");
                  }}
                >
                  <Text style={{ color: GREEN, fontWeight: "900", fontSize: 16 }}>Next</Text>
                </TouchableOpacity>
              }
            />
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 44 }}>
              <Text style={styles.secLabel}>Add tags</Text>
              <View style={styles.rowInput}>
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={addTag}
                  placeholder="#BuildInPublic"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.flexIn}
                />
                <TouchableOpacity onPress={addTag} style={styles.addSmall}>
                  <Text style={{ color: GREEN, fontWeight: "900" }}>Add</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tagsWrap}>
                {tags.map((t) => (
                  <TouchableOpacity key={t} style={styles.tagChip} onPress={() => setTags(tags.filter((x) => x !== t))}>
                    <Text style={styles.tagTxt}>#{t}</Text>
                    <Feather name="x" size={12} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.detailBlock, { marginTop: 20 }]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.blockTitle}>Add milestone (optional)</Text>
                  <Switch
                    value={milestonesEnabled}
                    onValueChange={setMilestonesEnabled}
                    trackColor={{ false: "#444", true: GREEN }}
                  />
                </View>
                {milestonesEnabled ? (
                  <>
                    {milestones.map((m, i) => (
                      <TextInput
                        key={i}
                        value={m}
                        onChangeText={(tx) =>
                          setMilestones((prev) => {
                            const n = [...prev];
                            n[i] = tx;
                            return n;
                          })
                        }
                        placeholder={`Milestone ${i + 1}`}
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        style={styles.singleInput}
                      />
                    ))}
                    <TouchableOpacity
                      onPress={() => setMilestones((p) => [...p, ""])}
                      style={{ marginTop: 8 }}
                    >
                      <Text style={{ color: GREEN, fontWeight: "800" }}>+ Add another milestone</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>

              <View style={[styles.detailBlock, { marginTop: 18 }]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.blockTitle}>Add poll (optional)</Text>
                  <Switch value={pollEnabled} onValueChange={setPollEnabled} trackColor={{ false: "#444", true: GREEN }} />
                </View>
                {pollEnabled ? (
                  <>
                    <TextInput
                      value={pollQuestion}
                      onChangeText={setPollQuestion}
                      placeholder="Ask a question…"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      style={styles.singleInput}
                    />
                    {pollOptions.map((o, i) => (
                      <TextInput
                        key={i}
                        value={o}
                        onChangeText={(tx) =>
                          setPollOptions((prev) => {
                            const n = [...prev];
                            n[i] = tx;
                            return n;
                          })
                        }
                        placeholder={`Option ${i + 1}`}
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        style={styles.singleInput}
                      />
                    ))}
                    <TouchableOpacity onPress={() => setPollOptions((p) => [...p, ""])} style={{ marginTop: 8 }}>
                      <Text style={{ color: GREEN, fontWeight: "800" }}>+ Add option</Text>
                    </TouchableOpacity>
                    <View style={styles.pollPreview}>
                      <Text style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>Preview</Text>
                      <View style={styles.pollBarRow}>
                        <View style={[styles.pollBar, { flex: 0.68, backgroundColor: GREEN }]} />
                        <View style={[styles.pollBar, { flex: 0.32, backgroundColor: "rgba(255,255,255,0.15)" }]} />
                      </View>
                      <Text style={{ color: "#fff", fontSize: 12, marginTop: 6 }}>68% · 32%</Text>
                    </View>
                  </>
                ) : null}
              </View>
            </ScrollView>
          </>
        ) : null}

        {step === "review" ? (
          <>
            <Header
              title="Review Update"
              onBack={goBack}
              right={
                <TouchableOpacity onPress={publish}>
                  <Text style={{ color: GREEN, fontWeight: "900", fontSize: 16 }}>Post</Text>
                </TouchableOpacity>
              }
            />
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
              <View style={styles.previewCard}>
                <View style={styles.badgeRow}>
                  <View style={styles.projBadge}>
                    <Text style={styles.projBadgeTxt}>Project Update</Text>
                  </View>
                </View>
                <Text style={styles.previewBody}>{buildPublishedContent({
                  body,
                  tags,
                  milestonesEnabled,
                  milestones,
                  pollEnabled,
                  pollQuestion,
                  pollOptions,
                })}</Text>
                {localMediaUri ? (
                  <Image source={{ uri: localMediaUri }} style={styles.previewImg} contentFit="cover" />
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.privacyRow}
                onPress={() =>
                  Alert.alert("Visibility", "", [
                    { text: "Everyone", onPress: () => setVisibility("Everyone") },
                    { text: "Team only", onPress: () => setVisibility("Team only") },
                    { text: "Cancel", style: "cancel" },
                  ])
                }
              >
                <Text style={{ color: "#fff", fontWeight: "700", flex: 1 }}>Who can see this?</Text>
                <Text style={{ color: MUTED }}>
                  {visibility} <Feather name="chevron-right" size={14} color={GREEN} />
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGreenWide} activeOpacity={0.92} onPress={publish}>
                <Text style={styles.btnGreenTxt}>Publish update</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: "center", paddingTop: 16 }} onPress={saveDraftExit}>
                <Text style={{ color: GREEN, fontWeight: "800", fontSize: 15 }}>Save Draft</Text>
              </TouchableOpacity>
            </ScrollView>
          </>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right: React.ReactNode;
}) {
  return (
    <View style={styles.hdr}>
      <TouchableOpacity onPress={onBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.hdrTitle}>{title}</Text>
      <View style={{ minWidth: 44, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

function ToolIcon({
  feather,
  ion,
  onPress,
}: {
  feather?: keyof typeof Feather.glyphMap;
  ion?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.toolIco} onPress={onPress}>
      {feather ? <Feather name={feather} size={20} color="#fff" /> : null}
      {ion ? <Ionicons name={ion} size={21} color="#fff" /> : null}
    </TouchableOpacity>
  );
}

function RowChk({
  done,
  label,
  spinner,
}: {
  done: boolean;
  label: string;
  spinner: boolean;
}) {
  return (
    <View style={styles.rowChk}>
      {done ? (
        <Ionicons name="checkmark-circle" size={22} color={GREEN} />
      ) : spinner ? (
        <ActivityIndicator color={GREEN} size="small" />
      ) : (
        <Ionicons name="ellipse-outline" size={22} color={MUTED} />
      )}
      <Text style={{ color: done ? "#fff" : MUTED, fontWeight: "700", fontSize: 15 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flexCenter: { flex: 1, backgroundColor: Colors.bgBlack, alignItems: "center", justifyContent: "center" },
  hdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  hdrTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: "800" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 16 },
  projRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  projRowActive: { borderColor: GREEN, backgroundColor: "rgba(34,197,94,0.12)" },
  projName: { color: "#fff", fontWeight: "800", fontSize: 16 },
  projDate: { color: MUTED, fontSize: 12, marginTop: 4 },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { backgroundColor: GREEN, borderColor: GREEN },
  secLabel: { color: MUTED, fontWeight: "800", fontSize: 12, marginTop: 20, marginBottom: 10 },
  singleInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  footerPad: {
    padding: 18,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: Colors.bgBlack,
  },
  btnGreen: {
    backgroundColor: GREEN,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  btnGreenWide: {
    backgroundColor: GREEN,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  btnGreenTxt: { color: "#fff", fontWeight: "900", fontSize: 17 },
  ctxChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
    marginBottom: 12,
  },
  ctxChipTxt: { color: "#fff", fontWeight: "800", fontSize: 14, flexShrink: 1, maxWidth: 280 },
  bigInput: {
    minHeight: 200,
    fontSize: 17,
    lineHeight: 25,
    color: "#fff",
  },
  toolRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  toolIco: { padding: 10 },
  stripMedia: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rowInput: { flexDirection: "row", alignItems: "center", gap: 10 },
  flexIn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  addSmall: { padding: 12 },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
  },
  tagTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  detailBlock: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  blockTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  pollPreview: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  pollBarRow: { flexDirection: "row", height: 10, borderRadius: 6, overflow: "hidden", gap: 2 },
  pollBar: { borderRadius: 4 },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 14,
    marginBottom: 16,
  },
  badgeRow: { flexDirection: "row", marginBottom: 10 },
  projBadge: {
    backgroundColor: "rgba(34,197,94,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.45)",
  },
  projBadgeTxt: { color: GREEN, fontWeight: "900", fontSize: 11 },
  previewBody: { color: "#fff", fontSize: 16, lineHeight: 24 },
  previewImg: { width: "100%", height: 180, borderRadius: 12, marginTop: 12 },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  postTitle: { color: "#fff", fontWeight: "800", marginTop: 20, fontSize: 17 },
  postSub: { color: MUTED, marginTop: 10, textAlign: "center" },
  chkCol: { marginTop: 28, gap: 14, alignSelf: "stretch", paddingHorizontal: 24 },
  rowChk: { flexDirection: "row", alignItems: "center", gap: 10 },
  pct: { color: GREEN, fontSize: 40, fontWeight: "900" },
  barOut: {
    marginTop: 16,
    height: 4,
    width: "85%",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 4,
    overflow: "hidden",
  },
  barIn: { height: "100%", backgroundColor: GREEN, borderRadius: 4 },
});
