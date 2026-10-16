import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/theme";
import { getTextDraft } from "@/utils/textDrafts.storage";
import { assistPost, type AIAssistAction } from "@/utils/ai.api";

const ACCENT = "#00E5FF";
const SCREEN_W = Dimensions.get("window").width;

const EMOJIS = [
  "🔥",
  "💯",
  "🚀",
  "⚡",
  "💪",
  "🎯",
  "✨",
  "🙌",
  "👏",
  "❤️",
  "😊",
  "🎉",
  "💡",
  "🌟",
  "💰",
  "🏆",
  "👀",
  "💬",
  "🤝",
  "🛠️",
  "📈",
  "🎨",
  "🌍",
  "⭐",
  "😅",
  "🤔",
  "💻",
  "📱",
  "🎤",
  "🏗️",
  "🔑",
  "🎪",
];

const AI_ACTIONS: { id: AIAssistAction; label: string; desc: string }[] = [
  { id: "improve", label: "✨ Improve writing", desc: "Make it more engaging" },
  { id: "expand", label: "📝 Expand post", desc: "Turn idea into full post" },
  { id: "shorten", label: "✂️ Shorten it", desc: "Under 150 characters" },
  { id: "hashtags", label: "#️⃣ Generate hashtags", desc: "Add relevant tags" },
];

const FONT_STYLES: { id: string; label: string; style: TextStyle }[] = [
  { id: "normal", label: "Normal", style: {} },
  { id: "bold", label: "Bold", style: { fontWeight: "700" as const } },
  { id: "italic", label: "Italic", style: { fontStyle: "italic" as const } },
  { id: "large", label: "Large", style: { fontSize: 22 } },
];

export default function NewTextPostScreen() {
  const params = useLocalSearchParams<{ draftId?: string }>();
  const inputRef = useRef<TextInput>(null);

  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [fontStyle, setFontStyle] = useState(FONT_STYLES[0]!);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [hasPoll, setHasPoll] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIOptions, setShowAIOptions] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = typeof params.draftId === "string" ? params.draftId : undefined;
    if (!id) {
      setHydrating(false);
      return undefined;
    }
    setHydrating(true);
    void (async () => {
      const d = await getTextDraft(id);
      if (cancelled) return;
      if (!d) {
        Alert.alert("Draft not found", "This draft may have been deleted.");
        setHydrating(false);
        return;
      }
      setContent(d.body);
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.draftId]);

  const handlePickImage = async () => {
    if (images.length >= 4) {
      Alert.alert("Max 4 images", "You can attach up to 4 images per post.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 4 - images.length),
      quality: 0.85,
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris].slice(0, 4));
    }
  };

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const closeComposerPanels = useCallback((except?: "ai" | "emoji" | "font" | "tag" | "poll") => {
    if (except !== "ai") setShowAIOptions(false);
    if (except !== "emoji") setShowEmojiPicker(false);
    if (except !== "font") setShowFontPicker(false);
    if (except !== "tag") setShowTagInput(false);
    if (except !== "poll") setShowPollBuilder(false);
  }, []);

  const handleAIButtonTap = () => {
    if (content.trim().length < 3) {
      Alert.alert(
        "Write something first",
        "Type a few words and AI will help expand your post.",
        [{ text: "OK" }],
      );
      return;
    }
    closeComposerPanels("ai");
    setShowAIOptions((p) => !p);
  };

  const handleAIAssist = async (action: AIAssistAction) => {
    setShowAIOptions(false);

    if (content.trim().length < 3) {
      Alert.alert(
        "Write something first",
        "Type a few words and AI will help with your post.",
        [{ text: "OK" }],
      );
      return;
    }

    setAiLoading(true);
    try {
      const { result } = await assistPost(content, action);

      if (action === "hashtags") {
        const newTags = result
          .split(/\s+/)
          .map((t) => (t.startsWith("#") ? t : `#${t.replace(/^#/, "")}`))
          .filter((t) => t.length > 1)
          .slice(0, 8);

        if (newTags.length > 0) {
          setTags((prev) => {
            const existing = new Set(prev);
            const combined = [
              ...prev,
              ...newTags.filter((t) => !existing.has(t)),
            ];
            return combined.slice(0, 10);
          });
          setShowTagInput(true);
          Alert.alert(
            "Hashtags added",
            `Added ${newTags.length} hashtag${newTags.length === 1 ? "" : "s"} to your post.`,
            [{ text: "Great!" }],
          );
        } else {
          Alert.alert("No hashtags", "AI did not return usable hashtags. Try again.");
        }
      } else {
        Alert.alert("AI suggestion", result, [
          { text: "Use this", onPress: () => setContent(result) },
          { text: "Keep original", style: "cancel" },
        ]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not reach AI service.";
      Alert.alert("AI error", msg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleEmojiPress = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleLocation = async () => {
    if (locationLabel) {
      setLocationLabel("");
      return;
    }

    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow location access to tag your location.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync(loc.coords);
      const g = geo[0];
      const place =
        `${g?.city ?? g?.district ?? ""}${g?.city || g?.district ? ", " : ""}${g?.country ?? ""}`.trim();
      setLocationLabel(place || "Unknown place");
    } catch {
      Alert.alert("Location unavailable", "Could not get your current location.");
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleFontStyleToggle = () => {
    closeComposerPanels("font");
    setShowFontPicker((p) => !p);
  };

  const handleTagToggle = () => {
    closeComposerPanels("tag");
    setShowTagInput((p) => !p);
  };

  const addTag = () => {
    const raw = tagInput.trim().replace(/^#/, "").replace(/\s+/g, "");
    const chip = raw ? `#${raw}` : "";
    if (chip && !tags.includes(chip) && tags.length < 10) {
      setTags((prev) => [...prev, chip]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handlePollToggle = () => {
    closeComposerPanels("poll");
    setShowPollBuilder((was) => {
      const next = !was;
      if (next) {
        setHasPoll(true);
        setPollOptions(["", ""]);
      } else {
        setHasPoll(false);
        setPollOptions(["", ""]);
      }
      return next;
    });
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) setPollOptions((prev) => [...prev, ""]);
  };

  const handleMore = () => {
    Alert.alert("More options", undefined, [
      {
        text: "📋 Copy draft",
        onPress: () => void Clipboard.setStringAsync(content).then(() => Alert.alert("Copied!", "Post text copied.")),
      },
      { text: "💾 Save as draft", onPress: () => Alert.alert("Coming soon", "Device drafts resume from Quick Create → Drafts.") },
      { text: "🔗 Add link", onPress: () => Alert.alert("Coming soon", "Link preview coming soon.") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const validPollOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
  const validPoll = hasPoll && validPollOpts.length >= 2;

  const canNext = content.trim().length > 0 || images.length > 0 || validPoll;

  const handleNext = () => {
    if (!canNext) {
      Alert.alert("Empty post", "Write something, add images, or create a poll with at least two options.");
      return;
    }

    router.push({
      pathname: "/text-post-publish",
      params: {
        content: content.trim(),
        images: JSON.stringify(images),
        tags: JSON.stringify(tags),
        location: locationLabel,
        fontStyleId: fontStyle.id,
        hasPoll: hasPoll ? "true" : "false",
        pollOptions: JSON.stringify(pollOptions.map((o) => o.trim()).filter(Boolean)),
      },
    });
  };

  const emojiCellW = useMemo(() => Math.max(36, (SCREEN_W - 32 - 28) / 8), []);

  if (hydrating) {
    return (
      <SafeAreaView style={styles.loader} edges={["top", "bottom"]}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={styles.loaderTxt}>Loading draft…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Text Post</Text>
        <TouchableOpacity
          style={[styles.nextBtn, !canNext && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canNext}
        >
          <Text style={styles.nextBtnText}>Next</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <TextInput
            ref={inputRef}
            style={[styles.textInput, fontStyle.style]}
            placeholder={"What's on your mind?"}
            placeholderTextColor="#444444"
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            maxLength={5000}
          />

          {content.length > 100 ? <Text style={styles.charCount}>{content.length}/5000</Text> : null}

          {locationLabel ? (
            <TouchableOpacity style={styles.locationTag} onPress={() => void handleLocation()}>
              <Ionicons name="location" size={14} color={ACCENT} />
              <Text style={styles.locationText}>{locationLabel}</Text>
              <Ionicons name="close-circle" size={14} color="#666666" />
              </TouchableOpacity>
          ) : null}

          {tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {tags.map((tag) => (
                <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => removeTag(tag)}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <Ionicons name="close" size={12} color={ACCENT} />
              </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {images.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imagesScroll}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
              {images.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.imagePreviewContainer}>
                  <Image source={{ uri }} style={styles.imagePreview} contentFit="cover" />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 4 ? (
                <TouchableOpacity style={styles.addMoreImage} onPress={() => void handlePickImage()}>
                  <Ionicons name="add" size={28} color={ACCENT} />
                </TouchableOpacity>
              ) : null}
            </ScrollView>
        ) : null}

          {showTagInput ? (
            <View style={styles.tagInputContainer}>
              <Text style={styles.tagInputLabel}>Add hashtags (max 10)</Text>
              <View style={styles.tagInputRow}>
                <Text style={styles.hashPrefix}>#</Text>
                <TextInput
                  style={styles.tagTextInput}
                  placeholder="startup, saas, buildinpublic..."
                  placeholderTextColor="#555555"
                  value={tagInput}
                  onChangeText={setTagInput}
                  autoCapitalize="none"
                  onSubmitEditing={addTag}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addTagBtn} onPress={addTag}>
                  <Text style={styles.addTagBtnText}>Add</Text>
              </TouchableOpacity>
              </View>
              <Text style={styles.tagHint}>
                Tap &quot;Add&quot; or Done on the keyboard after each tag • {tags.length}/10 tags
              </Text>
            </View>
          ) : null}

          {showFontPicker ? (
            <View style={styles.fontPicker}>
              <Text style={styles.fontPickerLabel}>Text style</Text>
              <View style={styles.fontOptions}>
                {FONT_STYLES.map((fs) => (
              <TouchableOpacity
                    key={fs.id}
                    style={[styles.fontOption, fontStyle.id === fs.id && styles.fontOptionActive]}
                    onPress={() => {
                      setFontStyle(fs);
                      setShowFontPicker(false);
                    }}
                  >
                    <Text style={[styles.fontOptionText, fs.style, fontStyle.id === fs.id && styles.fontOptionTextActive]}>
                      {fs.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {showEmojiPicker ? (
            <View style={styles.emojiPicker}>
              <Text style={styles.emojiPickerLabel}>Add emoji</Text>
              <View style={styles.emojiGrid}>
                {EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.emojiBtn, { width: emojiCellW }]}
                    onPress={() => handleEmojiPress(emoji)}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {showPollBuilder ? (
            <View style={styles.pollBuilder}>
              <View style={styles.pollHeader}>
                <Ionicons name="bar-chart-outline" size={18} color={ACCENT} />
                <Text style={styles.pollTitle}>Poll options</Text>
              </View>
              {pollOptions.map((option, index) => (
                <View key={`po-${index}`} style={styles.pollOptionRow}>
                  <Text style={styles.pollOptionNum}>{index + 1}</Text>
                  <TextInput
                    style={styles.pollOptionInput}
                    placeholder={`Option ${index + 1}...`}
                    placeholderTextColor="#555555"
                    value={option}
                    onChangeText={(text) => {
                      const updated = [...pollOptions];
                      updated[index] = text;
                      setPollOptions(updated);
                    }}
                    maxLength={60}
                  />
                  {index > 1 ? (
              <TouchableOpacity
                      onPress={() => setPollOptions((prev) => prev.filter((_, i) => i !== index))}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={20} color="#666" />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: 20 }} />
                  )}
                </View>
              ))}
              {pollOptions.length < 4 ? (
                <TouchableOpacity style={styles.addOptionBtn} onPress={addPollOption}>
                  <Ionicons name="add" size={18} color={ACCENT} />
                  <Text style={styles.addOptionText}>Add option</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.pollHint}>Poll stays on your post for 24 hours (demo copy).</Text>
            </View>
          ) : null}

          <View style={{ height: 120 }} />
        </ScrollView>

        {showAIOptions ? (
          <View style={styles.aiPanel}>
            <View style={styles.aiPanelHeader}>
              <Text style={styles.aiPanelTitle}>⚡ AI Assist</Text>
              <TouchableOpacity onPress={() => setShowAIOptions(false)} hitSlop={8}>
                <Ionicons name="close" size={18} color="#888888" />
              </TouchableOpacity>
            </View>
            {AI_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.aiActionRow}
                onPress={() => void handleAIAssist(action.id)}
                disabled={aiLoading}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiActionLabel}>{action.label}</Text>
                  <Text style={styles.aiActionDesc}>{action.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#444444" />
              </TouchableOpacity>
            ))}
                </View>
        ) : null}

        <View style={styles.toolbar}>
          <View style={styles.toolbarRow}>
            <TouchableOpacity style={styles.toolBtn} onPress={() => void handlePickImage()}>
              <Ionicons name="image-outline" size={22} color={images.length > 0 ? ACCENT : "#FFFFFF"} />
              {images.length > 0 ? (
                <View style={styles.toolBadge}>
                  <Text style={styles.toolBadgeText}>{images.length}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

              <TouchableOpacity
              style={[styles.toolBtn, (showAIOptions || aiLoading) && styles.toolBtnAIActive]}
              onPress={handleAIButtonTap}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Ionicons
                  name="flash"
                  size={22}
                  color={showAIOptions ? ACCENT : "#FFFFFF"}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => {
                closeComposerPanels("emoji");
                setShowEmojiPicker((v) => !v);
              }}
            >
              <Ionicons name="happy-outline" size={22} color={showEmojiPicker ? ACCENT : "#FFFFFF"} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={() => void handleLocation()} disabled={loadingLocation}>
              {loadingLocation ? (
                <ActivityIndicator color={ACCENT} size="small" />
              ) : (
                <Ionicons name="location-outline" size={22} color={locationLabel ? ACCENT : "#FFFFFF"} />
              )}
              </TouchableOpacity>
              </View>

          <View style={[styles.toolbarRow, styles.toolbarRow2]}>
                <TouchableOpacity
              style={[styles.toolBtn2, showFontPicker && styles.toolBtn2Active]}
              onPress={handleFontStyleToggle}
            >
              <Text style={[styles.toolBtn2Text, showFontPicker && styles.toolBtn2TextActive]}>Aa</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.toolBtn2, showTagInput && styles.toolBtn2Active]} onPress={handleTagToggle}>
              <Ionicons name="pricetag-outline" size={20} color={showTagInput ? ACCENT : "#FFFFFF"} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.toolBtn2, showPollBuilder && styles.toolBtn2Active]} onPress={handlePollToggle}>
              <Ionicons name="stats-chart-outline" size={20} color={showPollBuilder ? ACCENT : "#FFFFFF"} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn2} onPress={handleMore}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
                </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {aiLoading ? (
        <View style={styles.aiLoadingOverlay} pointerEvents="auto">
          <View style={styles.aiLoadingCard}>
            <ActivityIndicator color={ACCENT} size="large" />
            <Text style={styles.aiLoadingText}>AI is writing…</Text>
            <Text style={styles.aiLoadingSubtext}>Just a moment ✨</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBlack },
  loader: { flex: 1, backgroundColor: Colors.bgBlack, alignItems: "center", justifyContent: "center" },
  loaderTxt: { color: "#8E8E93", marginTop: 12, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  nextBtn: { backgroundColor: ACCENT, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8 },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: "#000000", fontWeight: "700", fontSize: 15 },
  textInput: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 26,
    padding: 16,
    minHeight: 220,
    textAlignVertical: "top",
  },
  charCount: {
    color: "#444444",
    fontSize: 12,
    textAlign: "right",
    paddingHorizontal: 16,
    marginTop: -8,
    marginBottom: 4,
  },
  locationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "rgba(0,229,255,0.1)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  locationText: { color: ACCENT, fontSize: 13, fontWeight: "500", flexShrink: 1 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginTop: 12 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1A3A4A",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  tagChipText: { color: ACCENT, fontSize: 13, fontWeight: "500" },
  imagesScroll: { marginTop: 12, marginBottom: 4 },
  imagePreviewContainer: { position: "relative" },
  imagePreview: { width: 100, height: 100, borderRadius: 10 },
  removeImageBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#000000",
    borderRadius: 999,
  },
  addMoreImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1F1F1F",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  tagInputContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#111111",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  tagInputLabel: { color: "#888888", fontSize: 12, marginBottom: 8 },
  tagInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hashPrefix: { color: ACCENT, fontSize: 18, fontWeight: "700" },
  tagTextInput: { flex: 1, color: "#FFFFFF", fontSize: 15, paddingVertical: 6 },
  addTagBtn: { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  addTagBtnText: { color: "#000000", fontWeight: "700", fontSize: 13 },
  tagHint: { color: "#555555", fontSize: 11, marginTop: 8 },
  fontPicker: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#111111",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  fontPickerLabel: { color: "#888888", fontSize: 12, marginBottom: 10 },
  fontOptions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fontOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
    minWidth: "22%",
    flexGrow: 1,
  },
  fontOptionActive: { borderColor: ACCENT, backgroundColor: "#0D2A35" },
  fontOptionText: { color: "#FFFFFF", fontSize: 15 },
  fontOptionTextActive: { color: ACCENT },
  emojiPicker: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#111111",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  emojiPickerLabel: { color: "#888888", fontSize: 12, marginBottom: 10 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  emojiBtn: { paddingVertical: 6, alignItems: "center" },
  emoji: { fontSize: 24 },
  pollBuilder: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#111111",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  pollHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  pollTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  pollOptionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  pollOptionNum: { color: "#888888", fontSize: 13, fontWeight: "700", width: 18, textAlign: "center" },
  pollOptionInput: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  addOptionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, marginTop: 4 },
  addOptionText: { color: ACCENT, fontSize: 14, fontWeight: "500" },
  pollHint: { color: "#555555", fontSize: 12, marginTop: 8 },
  toolbar: {
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
    paddingBottom: Platform.OS === "android" ? 8 : 0,
  },
  toolbarRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 4 },
  toolbarRow2: {
    backgroundColor: "#111111",
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    paddingVertical: 6,
  },
  toolBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, position: "relative" },
  toolBadge: {
    position: "absolute",
    top: 4,
    right: "18%",
    backgroundColor: ACCENT,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toolBadgeText: { color: "#000000", fontSize: 9, fontWeight: "800" },
  toolBtn2: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 10 },
  toolBtn2Active: { backgroundColor: "#0D2A35" },
  toolBtn2Text: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  toolBtn2TextActive: { color: ACCENT },
  toolBtnAIActive: {
    backgroundColor: "rgba(0,229,255,0.12)",
    borderRadius: 12,
  },
  aiPanel: {
    backgroundColor: "#111111",
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  aiPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  aiPanelTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: 0.5,
  },
  aiActionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    gap: 12,
  },
  aiActionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  aiActionDesc: { fontSize: 12, color: "#888888" },
  aiLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  aiLoadingCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  aiLoadingText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  aiLoadingSubtext: {
    color: "#888888",
    fontSize: 14,
  },
});
