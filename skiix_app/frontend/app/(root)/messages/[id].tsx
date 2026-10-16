import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Dimensions,
  BackHandler,
  type ListRenderItem,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/store/auth.store";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { fetchPeerIdByEmail, ensureProfilesEmailNormalized } from "@/services/profileIdentity";
import { profilePathFromIds } from "@/utils/profileNav";
import { cleanHandle, displayFullName } from "@/utils/displayIdentity";
import {
  createOrGetConversation,
  markConversationRead,
  sendTypingIndicator,
} from "@/services/conversationsService";
import { connectMessagingSocket, onMessagingEvent } from "@/services/messagingSocket";

const SCREEN_W = Dimensions.get("window").width;

function one(v: string | string[] | undefined) {
  const x = Array.isArray(v) ? v[0] : v;
  return (x ?? "").toString();
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  );
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  message_type: string;
  media_url?: string;
  media_thumbnail?: string;
  media_name?: string;
  is_deleted: boolean;
  is_edited: boolean;
  created_at: string;
  status?: "sent" | "delivered" | "read";
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    username?: string | string[];
    fullName?: string | string[];
    avatarUrl?: string | string[];
    userId?: string | string[];
    lookupEmail?: string | string[];
  }>();

  const { user, session } = useAuth();
  const meId = user?.id ?? "";
  const token = session?.access_token ?? "";
  const base = getApiBaseUrl().replace(/\/$/, "");

  const pathId = useMemo(() => one(params.id).trim(), [params.id]);
  const [convId, setConvId] = useState(() =>
    pathId && pathId !== "new" && isUuid(pathId) ? pathId : "",
  );
  const [peerUserId, setPeerUserId] = useState(() => one(params.userId).trim());
  const lookupEmailRaw = useMemo(() => one(params.lookupEmail), [params.lookupEmail]);

  const headerFullName = useMemo(() => {
    const raw = one(params.fullName).trim();
    if (!raw) return "";
    try {
      return decodeURIComponent(raw).trim();
    } catch {
      return raw.trim();
    }
  }, [params.fullName]);

  const rawUsernameParam = useMemo(() => one(params.username), [params.username]);
  const displayUsername = useMemo(() => {
    let raw = rawUsernameParam;
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* keep literal */
    }
    const h = cleanHandle(raw);
    return h || "chat";
  }, [rawUsernameParam]);

  const primaryHeaderTitle = useMemo(
    () => displayFullName(headerFullName, displayUsername),
    [headerFullName, displayUsername],
  );

  const avatarFromRoute = useMemo(() => one(params.avatarUrl).trim(), [params.avatarUrl]);

  const openPeerProfile = useCallback(() => {
    if (!peerUserId?.trim() && (!displayUsername.trim() || displayUsername === "chat")) return;
    const href = profilePathFromIds(peerUserId, displayUsername);
    if (href) router.push(href);
  }, [peerUserId, displayUsername]);

  useEffect(() => {
    const p = one(params.id).trim();
    if (p && p !== "new" && isUuid(p)) setConvId(p);
  }, [params.id]);

  useEffect(() => {
    setPeerUserId(one(params.userId).trim());
  }, [params.userId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function resolvePeer() {
      if (peerUserId || !lookupEmailRaw.trim() || !meId) return;
      let q = lookupEmailRaw;
      try {
        q = decodeURIComponent(lookupEmailRaw.trim());
      } catch {
        q = lookupEmailRaw.trim();
      }
      const { peerId } = await fetchPeerIdByEmail(q);
      if (!cancelled && peerId) setPeerUserId(peerId);
    }
    void resolvePeer();
    return () => {
      cancelled = true;
    };
  }, [peerUserId, lookupEmailRaw, meId]);

  const authHeaders = useCallback(() => {
    const h: Record<string, string> = { Accept: "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const jsonAuthHeaders = useCallback(() => {
    const h = authHeaders();
    h["Content-Type"] = "application/json";
    return h;
  }, [authHeaders]);

  const openConversation = useCallback(
    async (recipientId: string): Promise<string> => {
      if (!recipientId.trim()) return "";
      try {
        const ref = await createOrGetConversation(recipientId.trim());
        return ref.id?.trim() || "";
      } catch (e) {
        if (__DEV__) console.warn("[Chat] createConversation", e);
        toast.error("Cannot message this user. Follow or join a shared project first.");
        return "";
      }
    },
    [],
  );

  const loadMessages = useCallback(
    async (cid: string) => {
      if (!base || !token || !cid) return;
      setLoading(true);
      try {
        const res = await fetch(
          `${base}/api/v1/conversations/${encodeURIComponent(cid)}/messages?limit=50`,
          { headers: authHeaders() },
        );
        const json = (await res.json().catch(() => ({}))) as { data?: Message[] };
        if (!res.ok) {
          setMessages([]);
          return;
        }
        setMessages(Array.isArray(json.data) ? json.data : []);
        void markConversationRead(cid);
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [authHeaders, base, token],
  );

  /** Open thread when we have peer but no conversation route id. */
  useEffect(() => {
    if (!token || convId || !peerUserId) return;
    let cancelled = false;
    (async () => {
      const id = await openConversation(peerUserId);
      if (!cancelled && id) setConvId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [convId, openConversation, peerUserId, token]);

  useEffect(() => {
    if (!meId || !user?.email) return;
    void ensureProfilesEmailNormalized(meId, user.email);
  }, [meId, user?.email]);

  useEffect(() => {
    if (!convId || !token) return;
    void loadMessages(convId);
  }, [convId, loadMessages, token]);

  useEffect(() => {
    if (!convId) return;
    const channel = supabase
      .channel(`chat-${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined;
          if (!row?.id || !row.sender_id || !row.created_at) return;
          const nm: Message = {
            id: String(row.id),
            sender_id: String(row.sender_id),
            content: row.content != null ? String(row.content) : "",
            message_type: row.message_type != null ? String(row.message_type) : "text",
            media_url: row.media_url != null ? String(row.media_url) : undefined,
            media_thumbnail:
              row.media_thumbnail != null ? String(row.media_thumbnail) : undefined,
            media_name: row.media_name != null ? String(row.media_name) : undefined,
            is_deleted: Boolean(row.is_deleted),
            is_edited: Boolean(row.is_edited),
            created_at:
              typeof row.created_at === "string"
                ? row.created_at
                : new Date().toISOString(),
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === nm.id)) return prev;
            return [nm, ...prev];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [convId]);

  useEffect(() => {
    if (!token) return;
    connectMessagingSocket(token);
    const unsub = onMessagingEvent((ev) => {
      if (ev.conversation_id !== convId) return;
      if (ev.event === "message_received" || ev.event === "message_sent") {
        const data = ev.data as Message | undefined;
        if (data?.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [data, ...prev];
          });
        } else if (convId) {
          void loadMessages(convId);
        }
      }
      if (ev.event === "message_read") {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_id === meId ? { ...m, status: "read" as const } : m,
          ),
        );
      }
      if (ev.event === "typing_start") setPeerTyping(true);
      if (ev.event === "typing_stop") setPeerTyping(false);
    });
    return unsub;
  }, [convId, loadMessages, meId, token]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showAttach) {
        setShowAttach(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [showAttach]);

  const uploadMedia = useCallback(
    async (uri: string, fileName: string, mimeType: string) => {
      if (!base || !token) throw new Error("Not signed in");
      const form = new FormData();
      form.append(
        "file",
        { uri, name: fileName, type: mimeType } as unknown as Blob,
      );
      const res = await fetch(`${base}/api/v1/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body: form,
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { secure_url?: string; url?: string };
        secure_url?: string;
        url?: string;
      };
      if (!res.ok) throw new Error("Upload failed");
      const url =
        json.data?.secure_url ||
        json.data?.url ||
        json.secure_url ||
        json.url ||
        "";
      if (!url) throw new Error("No URL from upload");
      return { url, thumbnail: "" as string };
    },
    [base, token],
  );

  const sendMediaMessage = useCallback(
    async (
      mediaUrl: string,
      msgType: string,
      thumbnail?: string,
      fileName?: string,
    ) => {
      let cid = convId;
      if (!cid && peerUserId) {
        cid = await openConversation(peerUserId);
        if (cid) setConvId(cid);
      }
      if (!cid || !token) {
        toast.error("Could not start conversation. Try again.");
        return;
      }
      const res = await fetch(`${base}/api/v1/conversations/${encodeURIComponent(cid)}/messages`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          content: fileName ?? " ",
          message_type: msgType,
          media_url: mediaUrl,
          media_thumbnail: thumbnail ?? null,
          media_name: fileName ?? null,
        }),
      });
      if (!res.ok) {
        toast.error("Could not send attachment.");
        return;
      }
      void loadMessages(cid);
    },
    [
      base,
      convId,
      openConversation,
      jsonAuthHeaders,
      loadMessages,
      peerUserId,
      token,
    ],
  );

  const onInputChange = (text: string) => {
    setInputText(text);
    if (!convId) return;
    void sendTypingIndicator(convId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      void sendTypingIndicator(convId, false);
    }, 2000);
  };

  const statusIcon = (status?: string) => {
    if (status === "read") return " ✓✓";
    if (status === "delivered") return " ✓✓";
    return " ✓";
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending || !token || !meId) return;

    let cid = convId;
    if (!cid && peerUserId) {
      cid = await openConversation(peerUserId);
      if (cid) setConvId(cid);
    }
    if (!cid) {
      toast.error("Could not start conversation. Try again.");
      return;
    }
    void sendTypingIndicator(cid, false);

    setInputText("");
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: meId,
      content: text,
      message_type: "text",
      is_deleted: false,
      is_edited: false,
      created_at: new Date().toISOString(),
      status: "sent",
    };
    setMessages((prev) => [optimistic, ...prev]);

    try {
      const res = await fetch(`${base}/api/v1/conversations/${encodeURIComponent(cid)}/messages`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          content: text,
          message_type: "text",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: Message };
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInputText(text);
        toast.error("Failed to send. Try again.");
        return;
      }
      if (json.data?.id) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? (json.data as Message) : m)));
      } else {
        void loadMessages(cid);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(text);
      toast.error("Failed to send. Try again.");
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    setShowAttach(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const { url } = await uploadMedia(uri, `img_${Date.now()}.jpg`, "image/jpeg");
      await sendMediaMessage(url, "image");
    } catch {
      toast.error("Could not send image.");
    } finally {
      setUploading(false);
    }
  };

  const handleCamera = async () => {
    setShowAttach(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]?.uri) return;
    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const { url } = await uploadMedia(uri, `photo_${Date.now()}.jpg`, "image/jpeg");
      await sendMediaMessage(url, "image");
    } catch {
      toast.error("Could not send photo.");
    } finally {
      setUploading(false);
    }
  };

  const handlePickVideo = async () => {
    setShowAttach(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setUploading(true);
    try {
      const a = result.assets[0];
      const uri = a.uri;
      const { url } = await uploadMedia(uri, `vid_${Date.now()}.mp4`, "video/mp4");
      await sendMediaMessage(url, "video");
    } catch {
      toast.error("Could not send video.");
    } finally {
      setUploading(false);
    }
  };

  const handlePickDocument = async () => {
    setShowAttach(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploading(true);
      try {
        const mime = asset.mimeType ?? "application/octet-stream";
        const { url } = await uploadMedia(
          asset.uri,
          asset.name || `file_${Date.now()}`,
          mime,
        );
        await sendMediaMessage(url, "document", undefined, asset.name || "File");
      } catch {
        toast.error("Could not send file.");
      } finally {
        setUploading(false);
      }
    } catch {
      toast.error("Could not pick file.");
    }
  };

  const renderMessage: ListRenderItem<Message> = useCallback(
    ({ item }) => {
      const isOwn = item.sender_id === meId;

      if (item.is_deleted) {
        return (
          <View style={[styles.msgRow, isOwn ? styles.msgRowOwn : undefined]}>
            <Text style={styles.deletedText}>Message deleted</Text>
          </View>
        );
      }

      return (
        <View style={[styles.msgRow, isOwn ? styles.msgRowOwn : undefined]}>
          {item.message_type === "image" && item.media_url ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/media-viewer",
                  params: {
                    uri: encodeURIComponent(item.media_url!),
                    type: "image",
                    username: displayUsername,
                  },
                })
              }
            >
              <Image source={{ uri: item.media_url }} style={styles.msgImage} contentFit="cover" />
            </TouchableOpacity>
          ) : null}

          {item.message_type === "video" && item.media_url ? (
            <TouchableOpacity
              style={styles.videoThumb}
              onPress={() =>
                router.push({
                  pathname: "/media-viewer",
                  params: {
                    uri: encodeURIComponent(item.media_url!),
                    type: "video",
                    username: displayUsername,
                  },
                })
              }
            >
              {item.media_thumbnail ? (
                <Image
                  source={{ uri: item.media_thumbnail }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                />
              ) : null}
              <View style={styles.playBtn}>
                <Ionicons name="play" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : null}

          {item.message_type === "document" ? (
            <View style={[styles.docCard, isOwn ? styles.docCardOwn : undefined]}>
              <Ionicons name="document-outline" size={26} color={isOwn ? "#000" : "#00E5FF"} />
              <Text style={[styles.docName, isOwn ? styles.docNameOwn : undefined]} numberOfLines={2}>
                {item.media_name || item.content || "File"}
              </Text>
            </View>
          ) : null}

          {item.message_type === "text" ? (
            <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : undefined]}>
                {item.content}
              </Text>
              <Text style={[styles.msgTime, isOwn ? styles.msgTimeOwn : undefined]}>
                {new Date(item.created_at).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {item.is_edited ? " · edited" : ""}
                {isOwn ? statusIcon(item.status) : ""}
              </Text>
            </View>
          ) : null}
        </View>
      );
    },
    [displayUsername, meId],
  );

  if (!token || !meId) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: "#94A3B8" }}>Sign in to use messages.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerUser}
          onPress={openPeerProfile}
          accessibilityRole="button"
          accessibilityLabel={`Open profile @${displayUsername}`}
        >
          {avatarFromRoute ? (
            <Image source={{ uri: avatarFromRoute }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>
                {(primaryHeaderTitle || "U").slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.headerFullName} numberOfLines={1}>
              {primaryHeaderTitle}
            </Text>
            <Text style={styles.headerUsername} numberOfLines={1}>
              @{displayUsername}
              {peerTyping ? " · typing…" : " · online"}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => toast.info("Voice calls coming soon.")}
          >
            <Ionicons name="call-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => toast.info("Video calls coming soon.")}
          >
            <Ionicons name="videocam-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading && !messages.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#00E5FF" size="large" />
        </View>
      ) : (
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <TouchableOpacity
                style={styles.emptyChat}
                onPress={openPeerProfile}
                activeOpacity={0.88}
                disabled={!displayUsername.trim() || displayUsername === "chat"}
                accessibilityRole="button"
              >
                {avatarFromRoute ? (
                  <Image
                    source={{ uri: avatarFromRoute }}
                    style={styles.emptyChatAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.emptyChatAvatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitialsLarge}>
                      {(primaryHeaderTitle || "U").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.emptyChatName}>{primaryHeaderTitle}</Text>
                <Text style={styles.emptyChatUsername}>@{displayUsername}</Text>
                <Text style={styles.emptyChatHint}>Send a message to start the conversation 👋</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {uploading ? (
        <View style={styles.uploadingBar}>
          <ActivityIndicator color="#00E5FF" size="small" />
          <Text style={styles.uploadingText}>Uploading…</Text>
        </View>
      ) : null}

      {showAttach ? (
        <View style={styles.attachMenu}>
          {(
            [
              ["image-outline", "Photo", handlePickImage],
              ["camera-outline", "Camera", handleCamera],
              ["videocam-outline", "Video", handlePickVideo],
              ["document-outline", "File", handlePickDocument],
            ] as const
          ).map(([icon, label, action]) => (
            <TouchableOpacity key={label} style={styles.attachItem} onPress={() => void action()}>
              <View style={styles.attachIcon}>
                <Ionicons name={icon} size={22} color="#00E5FF" />
              </View>
              <Text style={styles.attachLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 0 : 88}
      >
        <View style={styles.inputBar}>
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              setShowAttach((v) => !v);
            }}
            style={styles.attachBtn}
          >
            <Ionicons
              name={showAttach ? "close-circle" : "add-circle"}
              size={30}
              color="#00E5FF"
            />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor="#555"
            value={inputText}
            onChangeText={onInputChange}
            multiline
            maxLength={1000}
            editable
            onFocus={() => setShowAttach(false)}
          />

          <TouchableOpacity
            style={[styles.sendBtn, { opacity: inputText.trim() ? 1 : 0.35 }]}
            onPress={() => void handleSend()}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="send" size={18} color="#000" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerUser: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 999 },
  avatarFallback: { backgroundColor: "#1A3A4A", alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: "#00E5FF", fontSize: 14, fontWeight: "700" },
  avatarInitialsLarge: { color: "#00E5FF", fontSize: 28, fontWeight: "800" },
  headerFullName: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  headerUsername: { fontSize: 11, color: "#888888", marginTop: 1 },
  headerActions: { flexDirection: "row", gap: 6 },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  messageList: { paddingHorizontal: 12, paddingVertical: 16 },
  msgRow: { marginBottom: 8, alignItems: "flex-start", maxWidth: "82%" },
  msgRowOwn: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn: { backgroundColor: "#00E5FF", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#1A1A1A", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: "#fff", lineHeight: 21 },
  bubbleTextOwn: { color: "#000" },
  msgTime: { fontSize: 10, color: "#555", marginTop: 3 },
  msgTimeOwn: { color: "rgba(0,0,0,0.5)" },
  deletedText: { fontSize: 13, color: "#444", fontStyle: "italic" },
  msgImage: {
    width: SCREEN_W * 0.62,
    height: SCREEN_W * 0.62,
    borderRadius: 14,
  },
  videoThumb: {
    width: SCREEN_W * 0.62,
    height: SCREEN_W * 0.38,
    borderRadius: 14,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  playBtn: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 12,
    maxWidth: SCREEN_W * 0.7,
  },
  docCardOwn: { backgroundColor: "#00E5FF" },
  docName: { fontSize: 13, color: "#fff", fontWeight: "500", flex: 1 },
  docNameOwn: { color: "#000" },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
    minHeight: 360,
  },
  emptyChatAvatar: { width: 80, height: 80, borderRadius: 999 },
  emptyChatName: { fontSize: 18, fontWeight: "700", color: "#fff" },
  emptyChatUsername: { fontSize: 12, color: "#888888", marginTop: 2 },
  emptyChatHint: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  uploadingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#0D2A35",
  },
  uploadingText: { color: "#00E5FF", fontSize: 13 },
  attachMenu: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "#0D0D0D",
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
  },
  attachItem: { alignItems: "center", gap: 6 },
  attachIcon: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#1F1F1F",
    alignItems: "center",
    justifyContent: "center",
  },
  attachLabel: { fontSize: 11, color: "#888" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "android" ? 14 : 10,
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
    backgroundColor: "#000",
    gap: 8,
  },
  attachBtn: { paddingBottom: 4 },
  input: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#00E5FF",
    alignItems: "center",
    justifyContent: "center",
  },
});
