import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import type { HomeFeedPost } from "@/types/homeFeed.types";
import { mvpFeaturesApi, type WorkspaceCategory } from "@/utils/mvpFeatures.api";
import { trackAnalytics } from "@/utils/analytics";

const CYAN = "#00E5FF";

type Props = {
  post: HomeFeedPost;
  visible: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<HomeFeedPost>) => void;
};

const WORKSPACE_OPTIONS: { key: WorkspaceCategory; label: string; icon: string }[] = [
  { key: "startup_ideas", label: "Startup Ideas", icon: "bulb-outline" },
  { key: "research", label: "Research", icon: "search-outline" },
  { key: "projects", label: "Projects", icon: "folder-outline" },
  { key: "learning", label: "Learning", icon: "book-outline" },
];

export function BookmarkActionSheet({ post, visible, onClose, onPatch }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const handle = post.author_username?.trim() || post.author_email.split("@")[0] || "creator";
  const title = post.content?.slice(0, 80) || "Skiix post";

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch {
      toast.error("Action failed. Sign in and try again.");
    } finally {
      setBusy(null);
    }
  };

  const savePost = () =>
    run("save", async () => {
      const res = await mvpFeaturesApi.toggleSave(post.id);
      onPatch({ is_saved: res.saved, saves_count: res.saves_count });
      toast.success(res.saved ? "Post saved" : "Removed from saves");
      void trackAnalytics("bookmark_save", { post_id: post.id });
      onClose();
    });

  const addReminder = () => {
    onClose();
    Alert.alert("Set reminder", "Remind you about this post tomorrow?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Tomorrow 9 AM",
        onPress: () => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(9, 0, 0, 0);
          void run("reminder", async () => {
            await mvpFeaturesApi.createReminder(post.id, d);
            toast.success("Reminder set");
            void trackAnalytics("bookmark_reminder", { post_id: post.id });
          });
        },
      },
    ]);
  };

  const addToCalendar = () =>
    run("calendar", async () => {
      const ics = await mvpFeaturesApi.fetchCalendarIcs(post.id);
      await Share.share({
        message: ics,
        title: `skiix-${post.id}.ics`,
      });
      toast.success("Calendar event ready — add via your calendar app");
      void trackAnalytics("bookmark_calendar", { post_id: post.id });
      onClose();
    });

  const convertToNote = () =>
    run("note", async () => {
      await mvpFeaturesApi.createNote(post.id, {
        title,
        content: post.content ?? "",
        creator_name: handle,
      });
      toast.success("Saved as note — edit anytime in workspace");
      void trackAnalytics("bookmark_note", { post_id: post.id });
      onClose();
    });

  const saveWorkspace = (category: WorkspaceCategory) =>
    run(`ws-${category}`, async () => {
      await mvpFeaturesApi.saveToWorkspace(post.id, category);
      toast.success(`Saved to ${category.replace("_", " ")}`);
      void trackAnalytics("bookmark_workspace", { post_id: post.id, category });
      onClose();
    });

  const rows: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  }[] = [
    { key: "save", label: "Save Post", icon: "bookmark-outline", onPress: savePost },
    { key: "reminder", label: "Add Reminder", icon: "alarm-outline", onPress: addReminder },
    { key: "calendar", label: "Add To Calendar", icon: "calendar-outline", onPress: addToCalendar },
    { key: "note", label: "Convert To Note", icon: "document-text-outline", onPress: convertToNote },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/75" onPress={onClose}>
        <SafeAreaView className="flex-1 justify-end" edges={["bottom"]}>
          <Pressable
            className="bg-[#0A0F12] rounded-t-[28px] border-t border-[#FFFFFF22] px-5 pt-4 pb-8"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="w-10 h-1 rounded-full bg-[#333] self-center mb-4" />
            <Text className="text-white font-spaceBold text-lg mb-1">Bookmark Actions</Text>
            <Text className="text-[#888] font-space text-xs mb-4" numberOfLines={2}>
              {title}
            </Text>

            {rows.map((row) => (
              <TouchableOpacity
                key={row.key}
                onPress={row.onPress}
                disabled={busy !== null}
                className="flex-row items-center gap-3 py-3.5 border-b border-[#FFFFFF10]"
              >
                {busy === row.key ? (
                  <ActivityIndicator color={CYAN} size="small" />
                ) : (
                  <Ionicons name={row.icon} size={22} color={CYAN} />
                )}
                <Text className="text-white font-space text-sm flex-1">{row.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#555" />
              </TouchableOpacity>
            ))}

            <Text className="text-[#666] font-spaceBold text-xs mt-4 mb-2 uppercase tracking-wider">
              Save To Workspace
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {WORKSPACE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => saveWorkspace(opt.key)}
                  disabled={busy !== null}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border border-[#00E5FF33] bg-[#0A1A20]"
                >
                  <Ionicons
                    name={opt.icon as keyof typeof Ionicons.glyphMap}
                    size={14}
                    color={CYAN}
                  />
                  <Text className="text-[#00E5FF] font-space text-xs">{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
