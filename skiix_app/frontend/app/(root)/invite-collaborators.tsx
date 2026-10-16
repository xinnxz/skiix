import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/store/auth.store";
import { searchProfilesByUsername, type ProfileSearchHit } from "@/services/profileSearch";
import { connectionsApi } from "@/utils/connections.api";
import { insertConnectionInviteNotification } from "@/services/appNotifications";

export default function InviteCollaboratorsScreen() {
  const { user } = useAuth();
  const myEmail = (user?.email ?? "").trim().toLowerCase();
  const myId = user?.id ?? "";
  const myHandle = user?.username ? `@${user.username.replace(/^@/, "")}` : "You";

  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<ProfileSearchHit[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const runSearch = useCallback(
    async (query: string) => {
      if (!myId) {
        setHits([]);
        return;
      }
      const clean = query.trim();
      if (clean.length < 2) {
        setHits([]);
        return;
      }
      setSearching(true);
      try {
        const rows = await searchProfilesByUsername(clean, { excludeUserId: myId, limit: 25 });
        setHits(rows);
      } catch (e: any) {
        setHits([]);
        Alert.alert("Search failed", String(e?.message ?? e));
      } finally {
        setSearching(false);
      }
    },
    [myId],
  );

  useEffect(() => {
    const t = setTimeout(() => void runSearch(q), 380);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  const sendInvite = async (hit: ProfileSearchHit) => {
    if (!myEmail || !myId) {
      Alert.alert("Sign in required", "Log in to send collaboration invites.");
      return;
    }
    const peerEmail = (hit.email_normalized ?? "").trim().toLowerCase();
    if (!peerEmail) {
      Alert.alert(
        "Profile not ready",
        "This member has not finished syncing their Skiix profile email yet. Ask them to open the app once, or connect by email from the feed.",
      );
      return;
    }
    if (peerEmail === myEmail) return;

    setInvitingId(hit.id);
    try {
      const row = await connectionsApi.requestAndResolvePending(myEmail, peerEmail);
      if (!row) {
        Alert.alert("Could not send invite", "Try again in a moment.");
        return;
      }
      if (row.status === "accepted") {
        Alert.alert("Already connected", `You are already connected with @${hit.username ?? "them"}.`);
        return;
      }
      if (row.status !== "pending") {
        Alert.alert("Invite not available", "This connection is not pending.");
        return;
      }

      const uname = hit.username ?? peerEmail.split("@")[0];
      const res = await insertConnectionInviteNotification({
        recipientUserId: hit.id,
        actorUserId: myId,
        connectionId: row.id,
        title: "Collaboration invite",
        body: `${myHandle} invited you to connect on Skiix.`,
      });
      if (res.duplicate) {
        Alert.alert("Already invited", "They already have a pending invite notification for this request.");
      } else {
        Alert.alert("Invite sent", `We notified @${uname}. They can accept from their notifications.`);
      }
    } catch (e: any) {
      Alert.alert("Invite failed", String(e?.message ?? e));
    } finally {
      setInvitingId(null);
    }
  };

  const confirmInvite = (hit: ProfileSearchHit) => {
    const handle = hit.username ? `@${hit.username}` : hit.email_normalized ?? "?";
    Alert.alert(
      "Send collaboration invite?",
      `${handle} will get a Skiix notification and can accept there.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          style: "default",
          onPress: () => void sendInvite(hit),
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3 border-b border-[#FFFFFF10]">
        <TouchableOpacity hitSlop={12} onPress={() => router.back()} className="p-2 mr-2">
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-spaceBold flex-1">Invite collaborators</Text>
      </View>

      {!myEmail ? (
        <Text className="text-[#94A3BB] px-6 mt-8">Sign in to invite collaborators by username.</Text>
      ) : (
        <>
          <View className="px-6 pt-6">
            <Text className="text-[#94A3BB] text-sm mb-3 leading-6">
              Search by Skiix username. We will send them an in-app notification to accept your
              collaboration invite.
            </Text>
            <View className="flex-row items-center rounded-2xl border border-[#FFFFFF18] px-4 py-3 bg-[#FFFFFF06]">
              <Feather name="search" size={20} color="#70DAFF" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Username (e.g. demo)"
                placeholderTextColor="#5C6678"
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 ml-3 text-white text-[16px]"
              />
              {!!q.length && (
                <TouchableOpacity onPress={() => setQ("")} hitSlop={10}>
                  <Ionicons name="close-circle" size={22} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View className="flex-1 px-6 pt-4">
            {searching ? (
              <View className="py-10 items-center">
                <ActivityIndicator color="#00E5FF" />
              </View>
            ) : q.trim().length < 2 ? (
              <Text className="text-[#5C6678] text-sm mt-4">
                Type at least 2 characters to search members.
              </Text>
            ) : hits.length === 0 ? (
              <Text className="text-[#5C6678] text-sm mt-4">No usernames match that search.</Text>
            ) : (
              hits.map((hit) => {
                const handle = hit.username ? `@${hit.username}` : "Member";
                const avatar =
                  hit.avatar_url?.trim() ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(handle)}&background=0A0F12&color=70DAFF`;
                const busy = invitingId === hit.id;
                return (
                  <TouchableOpacity
                    key={hit.id}
                    activeOpacity={0.88}
                    onPress={() => confirmInvite(hit)}
                    disabled={!!invitingId}
                    className="flex-row items-center py-4 border-b border-[#FFFFFF08]"
                  >
                    <Image
                      source={{ uri: avatar }}
                      className="w-12 h-12 rounded-full border border-[#FFFFFF14]"
                    />
                    <View className="flex-1 ml-3">
                      <Text className="text-white font-spaceBold text-[16px]">{handle}</Text>
                      {!!hit.email_normalized && (
                        <Text className="text-[#64748B] text-[11px] mt-1" numberOfLines={1}>
                          {hit.email_normalized}
                        </Text>
                      )}
                    </View>
                    {busy ? (
                      <ActivityIndicator color="#00E5FF" />
                    ) : (
                      <View className="px-3 py-2 rounded-xl border border-[#00E5FF55]">
                        <Text className="text-[#00E5FF] font-spaceBold text-[10px]">INVITE</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
