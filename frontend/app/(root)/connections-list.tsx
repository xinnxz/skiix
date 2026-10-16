import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/store/auth.store";
import { connectionsApi, ConnectionDTO } from "@/utils/connections.api";

function otherParty(c: ConnectionDTO, me: string): string {
  const m = me.toLowerCase();
  return c.from_email.toLowerCase() === m ? c.to_email : c.from_email;
}

export default function ConnectionsListScreen() {
  const { user } = useAuth();
  const email = (user?.email ?? "").trim().toLowerCase();
  const [rows, setRows] = useState<ConnectionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!email) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const all = await connectionsApi.list(email);
      setRows(all.filter((c) => c.status === "accepted"));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openDm = (peerEmail: string) => {
    router.push({
      pathname: "/dm",
      params: { with: encodeURIComponent(peerEmail.toLowerCase()) },
    });
  };

  const confirmDisconnect = (c: ConnectionDTO) => {
    const peer = otherParty(c, email);
    Alert.alert("Disconnect", `Remove connection with ${peer}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          try {
            await connectionsApi.remove(email, c.id);
            await load();
          } catch (e: any) {
            Alert.alert("Could not disconnect", String(e?.message ?? e));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.06)",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={{ position: "absolute", left: 14, padding: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color="white" />
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 17, fontWeight: "800" }}>
          Your connections
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#00E5FF" />
        </View>
      ) : rows.length === 0 ? (
        <View style={{ padding: 28 }}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 22 }}>
            No accepted connections yet. Send invites from posts or suggestions on the Network
            tab.
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 18, paddingBottom: 120 }}
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const peer = otherParty(item, email);
            const label = peer.split("@")[0] || peer;
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  marginBottom: 12,
                  borderRadius: 22,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              >
                <Image
                  source={{
                    uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      peer,
                    )}&background=0A0F12&color=70DAFF`,
                  }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: "white", fontWeight: "800" }}>{label}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>
                    {peer}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => openDm(peer)}
                  activeOpacity={0.85}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "800" }}>
                    MESSAGE
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDisconnect(item)}
                  activeOpacity={0.85}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: "#FF6B7A", fontSize: 10, fontWeight: "800" }}>
                    REMOVE
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
