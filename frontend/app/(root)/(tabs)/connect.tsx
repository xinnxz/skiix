import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/store/auth.store";
import { connectionsApi, ConnectionDTO } from "@/utils/connections.api";
import apiClient from "@/utils/axiosInstance";

function otherParty(c: ConnectionDTO, me: string): string {
  const m = me.toLowerCase();
  return c.from_email.toLowerCase() === m ? c.to_email : c.from_email;
}

function pairsInvolving(all: ConnectionDTO[], me: string, other: string): ConnectionDTO[] {
  const o = other.toLowerCase();
  const m = me.toLowerCase();
  return all.filter(
    (c) =>
      (c.from_email.toLowerCase() === m && c.to_email.toLowerCase() === o) ||
      (c.from_email.toLowerCase() === o && c.to_email.toLowerCase() === m),
  );
}

function findBestConn(all: ConnectionDTO[], me: string, other: string): ConnectionDTO | undefined {
  const m = me.toLowerCase();
  const o = other.toLowerCase();
  const matches = pairsInvolving(all, me, other);
  const accepted = matches.find((c) => c.status === "accepted");
  if (accepted) return accepted;
  const inbound = matches.find(
    (c) => c.status === "pending" && c.from_email.toLowerCase() === o && c.to_email.toLowerCase() === m,
  );
  if (inbound) return inbound;
  const outbound = matches.find(
    (c) => c.status === "pending" && c.from_email.toLowerCase() === m && c.to_email.toLowerCase() === o,
  );
  if (outbound) return outbound;
  return matches[0];
}

type Kind = "accepted" | "pending_out" | "pending_in" | "none";

function classify(all: ConnectionDTO[], me: string, other: string): Kind {
  const c = findBestConn(all, me, other);
  if (!c) return "none";
  const m = me.toLowerCase();
  if (c.status === "accepted") return "accepted";
  if (c.status === "pending") return c.from_email.toLowerCase() === m ? "pending_out" : "pending_in";
  return "none";
}

async function fetchFeedAuthorEmails(limit = 40): Promise<string[]> {
  try {
    const res = await apiClient.get<{ data: { author_email?: string }[] }>(
      "/api/v1/feed",
      { params: { limit, offset: 0 } },
    );
    const set = new Set<string>();
    for (const row of res.data.data ?? []) {
      const e = (row.author_email ?? "").trim().toLowerCase();
      if (e) set.add(e);
    }
    return [...set];
  } catch {
    return [];
  }
}

export default function ConnectScreen() {
  const { user } = useAuth();
  const email = (user?.email ?? "").trim().toLowerCase();

  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionDTO[]>([]);
  const [suggestedEmails, setSuggestedEmails] = useState<string[]>([]);
  const [busyPeer, setBusyPeer] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!email) {
      setConnections([]);
      setSuggestedEmails([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [conns, feedAuthors] = await Promise.all([
        connectionsApi.list(email),
        fetchFeedAuthorEmails(50),
      ]);
      setConnections(conns);

      const others = new Set<string>();
      for (const c of conns) others.add(otherParty(c, email).toLowerCase());
      for (const a of feedAuthors) others.add(a);
      others.delete(email);
      setSuggestedEmails([...others].sort());
    } catch {
      setConnections([]);
      setSuggestedEmails([]);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const acceptedCount = useMemo(
    () => connections.filter((c) => c.status === "accepted").length,
    [connections],
  );

  const openDm = (peerEmail: string) => {
    router.push({
      pathname: "/dm",
      params: { with: encodeURIComponent(peerEmail.toLowerCase()) },
    });
  };

  const onConnect = async (peerEmail: string) => {
    if (!email) return;
    const peer = peerEmail.toLowerCase();
    setBusyPeer(peer);
    try {
      await connectionsApi.request(email, peer);
      await reload();
    } catch (e: any) {
      Alert.alert("Connect failed", String(e?.message ?? e));
    } finally {
      setBusyPeer(null);
    }
  };

  const onAccept = async (conn: ConnectionDTO) => {
    setBusyPeer(conn.id);
    try {
      await connectionsApi.accept(conn.id);
      await reload();
    } catch (e: any) {
      Alert.alert("Accept failed", String(e?.message ?? e));
    } finally {
      setBusyPeer(null);
    }
  };

  const subtitleFor = (peerEmail: string) => {
    const k = classify(connections, email, peerEmail);
    if (k === "accepted") return "You're connected · message anytime";
    if (k === "pending_out") return "Invite pending";
    if (k === "pending_in") return "Wants to connect with you";
    return "From your feed · connect to collaborate";
  };

  const renderActions = (peerEmail: string) => {
    const k = classify(connections, email, peerEmail);
    const conn = findBestConn(connections, email, peerEmail);
    const busy = busyPeer === peerEmail.toLowerCase() || (conn && busyPeer === conn.id);

    if (!email) return null;

    if (k === "accepted") {
      return (
        <TouchableOpacity
          onPress={() => openDm(peerEmail)}
          activeOpacity={0.85}
          className="px-4 py-2 rounded-xl border border-[#FFFFFF33] bg-transparent"
        >
          <Text className="font-spaceBold text-[10px] uppercase text-[#FFFFFF99]">
            Message
          </Text>
        </TouchableOpacity>
      );
    }

    if (k === "pending_out") {
      return (
        <TouchableOpacity disabled className="px-4 py-2 rounded-xl border border-[#FFFFFF1A]">
          <Text className="font-spaceBold text-[10px] uppercase text-[#FFFFFF55]">
            Sent
          </Text>
        </TouchableOpacity>
      );
    }

    if (k === "pending_in" && conn) {
      return (
        <TouchableOpacity
          disabled={!!busyPeer}
          onPress={() => onAccept(conn)}
          activeOpacity={0.85}
          className="px-4 py-2 rounded-xl border border-[#00E5FF] bg-[#00E5FF20]"
        >
          <Text className="font-spaceBold text-[10px] uppercase text-[#00E5FF]">
            {busy ? "…" : "Accept"}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        disabled={!!busyPeer}
        onPress={() => onConnect(peerEmail)}
        activeOpacity={0.85}
        className="px-4 py-2 rounded-xl border border-[#00E5FF] bg-[#00E5FF20]"
      >
        <Text className="font-spaceBold text-[10px] uppercase text-[#00E5FF]">
          {busy ? "…" : "Connect"}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView edges={["top"]} className="flex-1">
        <View className="px-6 py-6">
          <Text className="text-white text-3xl font-spaceBold">Network</Text>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={!email}
            onPress={() => router.push("/connections-list")}
            className="mt-6 p-6 rounded-[32px] border border-[#00E5FF33] flex-row items-center justify-between"
            style={{ backgroundColor: "rgba(0, 229, 255, 0.05)" }}
          >
            <View>
              <Text className="text-[#00E5FF] font-spaceBold text-4xl">{acceptedCount}</Text>
              <Text className="text-[#94A3BB] font-space text-xs mt-1 uppercase tracking-widest">
                Total connections
              </Text>
              <Text className="text-[#FFFFFF44] font-space text-[10px] mt-2">
                Tap to view list · message or disconnect
              </Text>
            </View>
            <View className="bg-[#00E5FF] p-3 rounded-2xl shadow-lg shadow-cyan-500/50">
              <MaterialCommunityIcons name="transit-connection-variant" size={28} color="black" />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <View className="px-6 mb-4 flex-row justify-between items-center">
            <Text className="text-white font-spaceBold text-lg">People you may know</Text>
            <TouchableOpacity onPress={() => router.push("/connections-list")}>
              <Text className="text-[#00E5FF] font-space text-xs">Connections</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="py-16 items-center">
              <ActivityIndicator color="#00E5FF" />
            </View>
          ) : !email ? (
            <Text className="text-[#FFFFFF55] px-6">Sign in to see your network.</Text>
          ) : suggestedEmails.length === 0 ? (
            <Text className="text-[#FFFFFF55] px-6 mt-2 text-sm leading-6">
              No suggestions yet — post something or connect from the home feed first.
            </Text>
          ) : (
            <View className="px-6">
              {suggestedEmails.map((peerEmail) => {
                const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  peerEmail,
                )}&background=0A0F12&color=70DAFF`;
                const handle = `@${peerEmail.split("@")[0]}`;
                return (
                  <View
                    key={peerEmail}
                    className="flex-row items-center p-4 mb-4 rounded-3xl border border-[#FFFFFF1A]"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
                  >
                    <TouchableOpacity activeOpacity={0.85}>
                      <Image
                        source={{ uri: avatar }}
                        className="w-14 h-14 rounded-full border border-[#FFFFFF33]"
                      />
                    </TouchableOpacity>

                    <View className="flex-1 ml-4">
                      <Text className="text-white font-spaceBold text-base">{handle}</Text>
                      <Text className="text-[#94A3BB] font-space text-xs" numberOfLines={2}>
                        {subtitleFor(peerEmail)}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Ionicons name="sparkles-outline" size={12} color="#00E5FF" />
                        <Text className="text-[#00E5FF] font-space text-[10px] ml-1">
                          Skiix member
                        </Text>
                      </View>
                    </View>

                    {renderActions(peerEmail)}
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            disabled={!email}
            onPress={() => router.push("/invite-collaborators")}
            activeOpacity={0.88}
            className="mx-6 mt-4 p-5 rounded-3xl border border-dashed border-[#FFFFFF33] items-center flex-row justify-center bg-[#FFFFFF04]"
          >
            <Feather name="plus" size={20} color="#70DAFF" />
            <Text className="text-[#CBD5E1] font-spaceBold ml-2">Invite collaborators</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
