import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/theme";
import { deleteReelDraft, listReelDrafts, type ReelDraft } from "@/utils/reelDrafts.storage";
import { deleteStoryDraft, listStoryDrafts, type StoryDraft } from "@/utils/storyDrafts.storage";
import { deleteProjectUpdateDraft, listProjectUpdateDrafts, type ProjectUpdateDraft } from "@/utils/projectUpdateDrafts.storage";
import { deleteTextDraft, listTextDrafts, type TextDraft } from "@/utils/textDrafts.storage";

const ACCENT = "#00E5FF";
const STORY_PURPLE = "#A855F7";
const PROJECT_GREEN = "#22C55E";

function formatDraftTime(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

type DraftSection =
  | { title: string; kind: "story"; data: StoryDraft[] }
  | { title: string; kind: "project"; data: ProjectUpdateDraft[] }
  | { title: string; kind: "text"; data: TextDraft[] }
  | { title: string; kind: "reel"; data: ReelDraft[] };

export default function DraftsScreen() {
  const [storyItems, setStoryItems] = useState<StoryDraft[]>([]);
  const [projectItems, setProjectItems] = useState<ProjectUpdateDraft[]>([]);
  const [textItems, setTextItems] = useState<TextDraft[]>([]);
  const [reelItems, setReelItems] = useState<ReelDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, pu, t, r] = await Promise.all([
        listStoryDrafts(),
        listProjectUpdateDrafts(),
        listTextDrafts(),
        listReelDrafts(),
      ]);
      setStoryItems(s);
      setProjectItems(pu);
      setTextItems(t);
      setReelItems(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const sections = useMemo((): DraftSection[] => {
    const out: DraftSection[] = [];
    if (storyItems.length) out.push({ title: "Stories", kind: "story", data: storyItems });
    if (projectItems.length) out.push({ title: "Project updates", kind: "project", data: projectItems });
    if (textItems.length) out.push({ title: "Text posts", kind: "text", data: textItems });
    if (reelItems.length) out.push({ title: "Reels", kind: "reel", data: reelItems });
    return out;
  }, [storyItems, projectItems, textItems, reelItems]);

  const onContinueStory = (d: StoryDraft) => {
    router.push({ pathname: "/create-story", params: { draftId: d.id } });
  };

  const onContinueProject = (d: ProjectUpdateDraft) => {
    router.push({ pathname: "/create-project-update", params: { draftId: d.id } });
  };

  const onContinueText = (d: TextDraft) => {
    router.push({ pathname: "/create-text", params: { draftId: d.id } });
  };

  const onContinueReel = (d: ReelDraft) => {
    router.push({ pathname: "/create-reel", params: { draftId: d.id } });
  };

  const onDeleteStory = (d: StoryDraft) => {
    Alert.alert("Delete draft?", "This story draft will be removed from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteStoryDraft(d.id);
          void refresh();
        },
      },
    ]);
  };

  const onDeleteProject = (d: ProjectUpdateDraft) => {
    Alert.alert("Delete draft?", "This project update draft will be removed from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteProjectUpdateDraft(d.id);
          void refresh();
        },
      },
    ]);
  };

  const onDeleteText = (d: TextDraft) => {
    Alert.alert("Delete draft?", "This text draft will be removed from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTextDraft(d.id);
          void refresh();
        },
      },
    ]);
  };

  const onDeleteReel = (d: ReelDraft) => {
    Alert.alert("Delete draft?", "This reel draft will be removed from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteReelDraft(d.id);
          void refresh();
        },
      },
    ]);
  };

  const empty =
    !loading &&
    storyItems.length === 0 &&
    projectItems.length === 0 &&
    textItems.length === 0 &&
    reelItems.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgBlack }} edges={["top", "bottom"]}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.06)",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>Drafts</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : empty ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10 }}>
          <Ionicons name="documents-outline" size={42} color="rgba(255,255,255,0.25)" />
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: "600", textAlign: "center" }}>
            No drafts yet.
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", lineHeight: 19 }}>
            Saves: Stories (Story Details → Save Draft), Project updates (Review → Save Draft), Text (Review → Save), Reels (Add details → Save Draft).
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          stickySectionHeadersEnabled={false}
          keyExtractor={(item) => {
            if ("kind" in item && (item as ProjectUpdateDraft).kind === "project_update") {
              return `pu-${(item as ProjectUpdateDraft).id}`;
            }
            if ("body" in item) return `text-${(item as TextDraft).id}`;
            if ("hashtags" in item) return `reel-${(item as ReelDraft).id}`;
            return `story-${(item as StoryDraft).id}`;
          }}
          renderSectionHeader={({ section }) =>
            section.data.length === 0 ? null : (
              <Text
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 13,
                  fontWeight: "800",
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {section.title}
              </Text>
            )
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item, section }) => {
            if (section.kind === "project") {
              const d = item as ProjectUpdateDraft;
              const titleLine =
                (d.selectedProjectLabel || d.newProjectName || "Project").trim() || "Project";
              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "stretch",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(34,197,94,0.35)",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    marginHorizontal: 16,
                    marginBottom: 10,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: 88,
                      backgroundColor: "#0C120E",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 118,
                    }}
                  >
                    <Ionicons name="rocket-outline" size={28} color={PROJECT_GREEN} />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                      Updated {formatDraftTime(d.updatedAt)}
                    </Text>
                    <Text numberOfLines={1} style={{ color: "#fff", fontWeight: "900", marginTop: 6, fontSize: 15 }}>
                      {titleLine}
                    </Text>
                    <Text numberOfLines={2} style={{ color: "#fff", fontWeight: "600", fontSize: 13, marginTop: 6 }}>
                      {(d.body || "").trim() || "No description yet"}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textTransform: "capitalize", marginTop: 6 }}>
                      Step: {d.step}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                      <TouchableOpacity
                        onPress={() => onContinueProject(d)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 999,
                          backgroundColor: PROJECT_GREEN,
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>Continue</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onDeleteProject(d)}>
                        <Text style={{ color: Colors.destructive, fontWeight: "700", fontSize: 13, paddingVertical: 8 }}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }
            if (section.kind === "story") {
              const d = item as StoryDraft;
              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "stretch",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(168,85,247,0.25)",
                    marginHorizontal: 16,
                    marginBottom: 10,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: 88,
                      backgroundColor: "#121018",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 118,
                    }}
                  >
                    <Ionicons name="aperture" size={30} color={STORY_PURPLE} />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                      Updated {formatDraftTime(d.updatedAt)}
                    </Text>
                    <Text numberOfLines={2} style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginTop: 6 }}>
                      {d.caption.trim() ||
                        (d.mediaKind === "video" ? "Video story draft" : "Photo story draft")}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textTransform: "capitalize", marginTop: 6 }}>
                      Step: {d.step} · Filter: {d.filterKey}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                      <TouchableOpacity
                        onPress={() => onContinueStory(d)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 999,
                          backgroundColor: STORY_PURPLE,
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>Continue</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onDeleteStory(d)}>
                        <Text style={{ color: Colors.destructive, fontWeight: "700", fontSize: 13, paddingVertical: 8 }}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }
            if (section.kind === "text") {
              const d = item as TextDraft;
              return (
                <View
                  style={{
                    marginHorizontal: 16,
                    marginBottom: 10,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                    padding: 14,
                  }}
                >
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 8 }}>
                    Updated {formatDraftTime(d.updatedAt)}
                  </Text>
                  <Text numberOfLines={3} style={{ color: "#fff", fontWeight: "700", fontSize: 14, lineHeight: 19 }}>
                    {d.body.trim() || "Empty draft"}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 8, textTransform: "capitalize" }}>
                    Step: {d.step}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => onContinueText(d)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: ACCENT,
                      }}
                    >
                      <Text style={{ color: "#000", fontWeight: "900", fontSize: 13 }}>Continue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDeleteText(d)} hitSlop={8}>
                      <Text style={{ color: Colors.destructive, fontWeight: "700", fontSize: 13, paddingVertical: 8 }}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
            const d = item as ReelDraft;
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "stretch",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                  marginHorizontal: 16,
                  marginBottom: 10,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: 88,
                    backgroundColor: "#0D1216",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 120,
                  }}
                >
                  <Ionicons name="film-outline" size={28} color={ACCENT} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                    Updated {formatDraftTime(d.updatedAt)}
                  </Text>
                  <Text numberOfLines={2} style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginTop: 6 }}>
                    {(d.caption || d.hashtags || "Untitled reel").trim() || "Untitled reel"}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textTransform: "capitalize", marginTop: 6 }}>
                    Step: {d.step}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => onContinueReel(d)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: ACCENT,
                      }}
                    >
                      <Text style={{ color: "#000", fontWeight: "900", fontSize: 13 }}>Continue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDeleteReel(d)}>
                      <Text style={{ color: Colors.destructive, fontWeight: "700", fontSize: 13, paddingVertical: 8 }}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
