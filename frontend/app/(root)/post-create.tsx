import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/theme";
import { MediaPickerUpload } from "@/components/media/MediaPickerUpload";
import { useAuth } from "@/store/auth.store";
import { publicPostsApi } from "@/utils/publicPosts.api";

export default function PostCreateScreen() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const params = useLocalSearchParams<{ kind?: string | string[] }>();
  const kindRaw = params.kind;
  const kindStr = Array.isArray(kindRaw) ? kindRaw[0] : kindRaw;
  const isProjectPost = kindStr === "project";

  const [content, setContent] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canPost = useMemo(() => !!email && content.trim().length > 0, [email, content]);

  const post = async () => {
    if (!canPost) return;
    setSaving(true);
    try {
      await publicPostsApi.create({
        author_email: email,
        type: isProjectPost ? "project" : uploadedUrl ? "reel" : "text",
        content: content.trim(),
        media_url: uploadedUrl,
        project_id: isProjectPost ? undefined : null,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgBlack }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={26} color="white" />
          </TouchableOpacity>
          <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>
            {isProjectPost ? "Project Update" : "New Post"}
          </Text>
          <TouchableOpacity
            onPress={post}
            disabled={!canPost || saving}
            activeOpacity={0.85}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: canPost ? "#00E5FF" : "rgba(255,255,255,0.08)",
            }}
          >
            {saving ? (
              <ActivityIndicator color={Colors.bgBlack} />
            ) : (
              <Text style={{ color: Colors.bgBlack, fontWeight: "900" }}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <Text style={{ color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>
            Write something and optionally attach an image/video.
          </Text>

          <View style={{ marginBottom: 14 }}>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="What are you building today?"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={{
                minHeight: 140,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                padding: 14,
                color: "white",
                backgroundColor: "rgba(255,255,255,0.04)",
                textAlignVertical: "top",
              }}
              multiline
              maxLength={2000}
            />
          </View>

          <MediaPickerUpload onUploaded={(p) => setUploadedUrl(p.url)} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

