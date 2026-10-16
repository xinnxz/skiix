import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/store/auth.store";
import { mediaApi } from "@/utils/media.api";
import { projectsApi, type ProjectRowDTO } from "@/utils/projects.api";
import { createAuthenticatedPost } from "@/utils/posts.api";
import { getApiErrorMessage } from "@/utils/getApiErrorMessage";
import { refreshAfterPostCreate } from "@/utils/postCreation";
import { useQueryClient } from "@tanstack/react-query";

const BG = "#000000";
const CARD = "#111111";
const BORDER = "#1F1F1F";
const GREEN = "#22C55E";
const MUTED = "#888888";
const GOLD = "#F59E0B";
const CYAN = "#00E5FF";

type Step = "select" | "compose";

const MILESTONES = [
  { id: "launch", label: "🚀 Launch", color: GREEN },
  { id: "funding", label: "💰 Funding", color: GOLD },
  { id: "users", label: "👥 User milestone", color: CYAN },
  { id: "feature", label: "⚡ New feature", color: "#8B5CF6" },
  { id: "revenue", label: "📈 Revenue", color: GREEN },
  { id: "team", label: "🤝 Team update", color: "#EC4899" },
  { id: "pivot", label: "🔄 Pivot", color: GOLD },
  { id: "custom", label: "🏁 Custom", color: MUTED },
] as const;

function guessMime(uri: string, fallback: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return fallback || "image/jpeg";
}

export default function CreateProjectUpdateFlow() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const email = user?.email ?? "";

  const [step, setStep] = useState<Step>("select");

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projects, setProjects] = useState<ProjectRowDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectRowDTO | null>(null);
  const [newProjectName, setNewProjectName] = useState("");

  const [fromNewName, setFromNewName] = useState(false);
  const [displayProjectName, setDisplayProjectName] = useState("");
  const [persistedProjectId, setPersistedProjectId] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ label: string; value: string }[]>([]);
  const [metricLabel, setMetricLabel] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [showMilestoneSheet, setShowMilestoneSheet] = useState(false);
  const [showMetricInput, setShowMetricInput] = useState(false);

  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 280);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!email) {
        setProjects([]);
        setLoadingProjects(false);
        return;
      }
      setLoadingProjects(true);
      try {
        const list = await projectsApi.listMyProjects(email.toLowerCase(), debouncedSearch);
        if (!cancelled) setProjects(list);
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [email, debouncedSearch]);

  const canProceedSelect = Boolean(selectedProject) || newProjectName.trim().length >= 2;

  const canPublish = content.trim().length > 0 || images.length > 0;

  const goSelectNext = () => {
    if (!canProceedSelect || !email) return;
    const name = newProjectName.trim();
    if (name.length >= 2) {
      setFromNewName(true);
      setDisplayProjectName(name);
      setPersistedProjectId(null);
    } else if (selectedProject) {
      setFromNewName(false);
      setDisplayProjectName(selectedProject.content || "Project");
      setPersistedProjectId(selectedProject.id);
    }
    setStep("compose");
  };

  const goBack = () => {
    if (step === "select") router.back();
    else setStep("select");
  };

  const handleTextFormatTips = () => {
    Alert.alert(
      "Text format",
      "• Wrap words in **double asterisks** for bold emphasis\n• Start a line with # for a heading\n• Start a line with • for a bullet list",
      [{ text: "OK" }],
    );
  };

  const pickImages = async () => {
    if (images.length >= 4) {
      Alert.alert("Max 4 images", "You can attach up to 4 images.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow Photos to attach images.");
      return;
    }
    const remain = 4 - images.length;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: Platform.OS !== "web",
      selectionLimit: remain,
      quality: 0.85,
    });
    if (r.canceled) return;
    const uris = (r.assets ?? []).map((a) => a.uri).filter(Boolean);
    setImages((prev) => [...prev, ...uris].slice(0, 4));
  };

  const addMetric = () => {
    const v = metricValue.trim();
    const l = metricLabel.trim();
    if (!v || !l) return;
    setMetrics((prev) => [...prev, { label: l, value: v }]);
    setMetricLabel("");
    setMetricValue("");
    setShowMetricInput(false);
  };

  const publish = async () => {
    if (!email || !canPublish || publishing) return;
    if (!user?.email) {
      Alert.alert("Sign in required", "You need an account to publish.");
      return;
    }
    setPublishing(true);
    try {
      let projectId = persistedProjectId ?? "";
      if (fromNewName) {
        const row = await projectsApi.createProject(email, displayProjectName);
        projectId = row.id;
      }
      if (!projectId) {
        throw new Error("Missing project. Go back and pick or name a project.");
      }

      const uploaded: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const uri = images[i];
        const name = uri.split("/").pop() || `img_${i}.jpg`;
        const type = guessMime(uri, "image/jpeg");
        const up = await mediaApi.upload({ uri, name, type });
        uploaded.push(up.url);
      }

      const primary = uploaded[0] ?? null;
      const extra = uploaded.slice(1);

      const created = await createAuthenticatedPost({
        type: "project_update",
        content: content.trim(),
        media_url: primary,
        image_url: primary,
        project_id: projectId,
        category: "general",
        explore_title: fromNewName
          ? displayProjectName.toUpperCase()
          : `${displayProjectName.toUpperCase()} UPDATE`,
        extra_media_urls: extra,
        is_new_project: fromNewName,
        metrics: metrics.length > 0 ? JSON.stringify(metrics) : null,
        milestone_type: selectedMilestone,
        project_name: displayProjectName.trim(),
        visibility: "public",
        share_to_feed: true,
        share_to_profile: true,
      });

      await refreshAfterPostCreate(queryClient, email, {
        createdPost: created,
        username: user?.username,
      });

      Alert.alert(
        fromNewName ? "Project created" : "Update posted",
        fromNewName
          ? `${displayProjectName} is live — people can tap Join Project in the feed.`
          : "Your project update is now in the feed.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e: unknown) {
      Alert.alert("Could not publish", getApiErrorMessage(e));
    } finally {
      setPublishing(false);
    }
  };

  if (step === "select") {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Project</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <View style={styles.searchWrap}>
            <Feather name="search" size={18} color={MUTED} style={{ marginRight: 10 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search projects"
              placeholderTextColor={MUTED}
              style={styles.searchInput}
            />
          </View>
          {loadingProjects ? (
            <ActivityIndicator color={GREEN} style={{ marginTop: 24 }} />
          ) : projects.length === 0 ? (
            <Text style={styles.empty}>No projects match. Start a new one below.</Text>
          ) : (
            projects.map((p) => {
              const active = selectedProject?.id === p.id;
              const initials = (p.content || "?").slice(0, 2).toUpperCase();
              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.9}
                  onPress={() => {
                    setSelectedProject(p);
                    setNewProjectName("");
                  }}
                  style={[styles.projRow, active && styles.projRowActive]}
                >
                  <View style={styles.logoFall}>
                    <Text style={styles.logoInitials}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projName}>{p.content || "Untitled"}</Text>
                    <Text style={styles.projMeta}>
                      {new Date(p.created_at).toLocaleDateString()}
                      {typeof p.member_count === "number"
                        ? ` · ${p.member_count} member${p.member_count === 1 ? "" : "s"}`
                        : ""}
                    </Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioOn]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <Text style={styles.sectionLabel}>Or start a new project</Text>
          <TextInput
            value={newProjectName}
            onChangeText={(t) => {
              setNewProjectName(t);
              if (t.trim()) {
                setSelectedProject(null);
              }
            }}
            placeholder="New project name…"
            placeholderTextColor={MUTED}
            style={styles.textField}
          />
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            disabled={!canProceedSelect}
            style={[styles.btnGreen, !canProceedSelect && { opacity: 0.4 }]}
            onPress={goSelectNext}
          >
            <Text style={styles.btnGreenTxt}>Next</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} disabled={publishing}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{fromNewName ? "New Project" : "Project Update"}</Text>
          <TouchableOpacity
            onPress={() => void publish()}
            disabled={publishing || !canPublish}
            hitSlop={12}
          >
            {publishing ? (
              <ActivityIndicator color={GREEN} size="small" />
            ) : (
              <Text style={[styles.nextTxt, !canPublish && { opacity: 0.38 }]}>
                {fromNewName ? "Launch" : "Post"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 140 }}>
          <View style={styles.badgeRow}>
            <View style={styles.projBadge}>
              <Ionicons name="cube-outline" size={16} color={GREEN} />
              <Text style={styles.projBadgeTxt} numberOfLines={1}>
                {displayProjectName}
              </Text>
            </View>
            {fromNewName ? (
              <View style={styles.newTag}>
                <Text style={styles.newTagTxt}>NEW PROJECT</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.counter}>
            {content.trim().length}/1500
          </Text>

          <TextInput
            style={styles.bodyInput}
            placeholder={
              fromNewName
                ? "Describe your project. What problem does it solve?"
                : "What's new with your project?"
            }
            placeholderTextColor="#444444"
            value={content}
            onChangeText={(t) => setContent(t.slice(0, 1500))}
            multiline
            textAlignVertical="top"
          />

          {selectedMilestone ? (
            <View style={styles.milestonePill}>
              <Text style={styles.milestonePillTxt}>
                {MILESTONES.find((m) => m.id === selectedMilestone)?.label ?? "Milestone"}
              </Text>
              <TouchableOpacity onPress={() => setSelectedMilestone(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={MUTED} />
              </TouchableOpacity>
            </View>
          ) : null}

          {metrics.length > 0 ? (
            <View style={styles.metricsBox}>
              <Text style={styles.metricsTitle}>📊 Key metrics</Text>
              <View style={styles.metricGrid}>
                {metrics.map((m, i) => (
                  <View key={`${m.label}-${i}`} style={styles.metricCard}>
                    <TouchableOpacity
                      style={styles.metricRemove}
                      hitSlop={8}
                      onPress={() => setMetrics((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Ionicons name="close" size={14} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.metricValue}>{m.value}</Text>
                    <Text style={styles.metricLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {images.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
              {images.map((uri, index) => (
                <View key={uri} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                  <TouchableOpacity
                    style={styles.thumbRm}
                    onPress={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Ionicons name="close-circle" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {showMetricInput ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Add a metric</Text>
              <TextInput
                style={styles.panelInput}
                placeholder="Value (e.g. 1,000)"
                placeholderTextColor="#555"
                value={metricValue}
                onChangeText={setMetricValue}
              />
              <TextInput
                style={styles.panelInput}
                placeholder="Label (e.g. Users)"
                placeholderTextColor="#555"
                value={metricLabel}
                onChangeText={setMetricLabel}
              />
              <TouchableOpacity style={styles.panelBtn} onPress={addMetric}>
                <Text style={styles.panelBtnTxt}>Add metric</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {showMilestoneSheet ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Milestone type</Text>
              <View style={styles.msGrid}>
                {MILESTONES.map((ms) => (
                  <TouchableOpacity
                    key={ms.id}
                    style={[
                      styles.msChip,
                      selectedMilestone === ms.id && { borderColor: GOLD, backgroundColor: "#1A1500" },
                    ]}
                    onPress={() => {
                      setSelectedMilestone(ms.id === selectedMilestone ? null : ms.id);
                      setShowMilestoneSheet(false);
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13 }}>{ms.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {fromNewName ? (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={18} color={GREEN} />
              <Text style={styles.infoTxt}>
                After launching, people can tap &quot;Join Project&quot; in the feed to become members.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolBtn} onPress={handleTextFormatTips}>
            <Text style={styles.toolT}>T</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => void pickImages()}>
            <Ionicons name="images-outline" size={22} color={images.length ? GREEN : "#fff"} />
            {images.length > 0 ? (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountTxt}>{images.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, showMetricInput && { opacity: 0.7 }]}
            onPress={() => {
              setShowMetricInput((v) => !v);
              setShowMilestoneSheet(false);
            }}
          >
            <Ionicons
              name="stats-chart-outline"
              size={22}
              color={metrics.length > 0 || showMetricInput ? GREEN : "#fff"}
            />
            {metrics.length > 0 ? (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountTxt}>{metrics.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, showMilestoneSheet && { opacity: 0.7 }]}
            onPress={() => {
              setShowMilestoneSheet((v) => !v);
              setShowMetricInput(false);
            }}
          >
            <Ionicons
              name="flag-outline"
              size={22}
              color={selectedMilestone || showMilestoneSheet ? GREEN : "#fff"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  nextTxt: { color: GREEN, fontSize: 16, fontWeight: "800" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 16 },
  empty: { color: MUTED, textAlign: "center", marginTop: 20 },
  projRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  projRowActive: {
    borderColor: GREEN,
    backgroundColor: "#0A2010",
  },
  logoFall: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#1A3A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  logoInitials: { color: GREEN, fontSize: 16, fontWeight: "800" },
  projName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  projMeta: { color: MUTED, fontSize: 13, marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#444444",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: GREEN },
  radioDot: { width: 12, height: 12, borderRadius: 999, backgroundColor: GREEN },
  sectionLabel: { color: MUTED, fontWeight: "800", fontSize: 12, marginTop: 10, marginBottom: 10 },
  textField: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: BG,
  },
  btnGreen: {
    backgroundColor: GREEN,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  btnGreenTxt: { color: "#fff", fontWeight: "900", fontSize: 17 },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
    flexWrap: "wrap",
  },
  projBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A2010",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: GREEN,
    maxWidth: "70%",
  },
  projBadgeTxt: { color: GREEN, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  newTag: {
    backgroundColor: GOLD,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newTagTxt: { color: "#000", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  counter: { color: "#555555", fontSize: 12, paddingHorizontal: 16, marginTop: 12 },
  bodyInput: {
    color: "#fff",
    fontSize: 17,
    lineHeight: 26,
    padding: 16,
    minHeight: 200,
  },
  milestonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    alignSelf: "flex-start",
    backgroundColor: "#1A1A10",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: GOLD,
  },
  milestonePillTxt: { color: GOLD, fontSize: 14, fontWeight: "600" },
  metricsBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  metricsTitle: { color: MUTED, fontSize: 12, marginBottom: 10 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    padding: 12,
    minWidth: 88,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GREEN,
    position: "relative",
  },
  metricRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#000",
    borderRadius: 999,
    padding: 2,
  },
  metricValue: { color: GREEN, fontSize: 20, fontWeight: "800" },
  metricLabel: { color: MUTED, fontSize: 11, marginTop: 2 },
  thumbWrap: { position: "relative" },
  thumb: { width: 100, height: 100, borderRadius: 10, backgroundColor: "#1A1A1A" },
  thumbRm: { position: "absolute", top: -4, right: -4 },
  panel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  panelTitle: { color: MUTED, fontSize: 13, fontWeight: "600" },
  panelInput: {
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  panelBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  panelBtnTxt: { color: "#000", fontWeight: "800" },
  msGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  msChip: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#0A2010",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: GREEN,
  },
  infoTxt: { color: GREEN, fontSize: 13, flex: 1, lineHeight: 18 },
  toolbar: {
    flexDirection: "row",
    backgroundColor: CARD,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  toolBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    position: "relative",
  },
  toolT: { color: "#fff", fontSize: 18, fontWeight: "800" },
  badgeCount: {
    position: "absolute",
    top: 4,
    right: 16,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeCountTxt: { color: "#000", fontSize: 9, fontWeight: "900" },
});
