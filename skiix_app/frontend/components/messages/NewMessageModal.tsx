import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchEligibleContacts,
  type EligibleContact,
} from "@/services/conversationsService";
import { cleanHandle, displayFullName } from "@/utils/displayIdentity";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (contact: EligibleContact) => void;
  excludeIds?: Set<string>;
};

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    following: "Following",
    follower: "Follower",
    project_member: "Project",
    project_owner: "Founder",
    conversation: "Chat",
    connection: "Connection",
  };
  return map[source] ?? "Contact";
}

export function NewMessageModal({ visible, onClose, onSelect, excludeIds }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<EligibleContact[]>([]);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const rows = await fetchEligibleContacts(q, 60);
      setContacts(rows.filter((c) => !excludeIds?.has(c.id)));
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [excludeIds]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => void load(query), query ? 280 : 0);
    return () => clearTimeout(t);
  }, [visible, query, load]);

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/80" onPress={onClose}>
        <SafeAreaView className="flex-1 justify-end" edges={["bottom"]}>
          <Pressable
            className="bg-[#0A0F12] rounded-t-[28px] border-t border-[#FFFFFF22] max-h-[85%]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="px-5 pt-4 pb-3 border-b border-[#FFFFFF10]">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-white font-spaceBold text-lg">New Message</Text>
                <TouchableOpacity onPress={onClose} hitSlop={12}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>
              <Text className="text-[#888] font-space text-xs mb-3">
                People you follow, followers, project members, and existing contacts
              </Text>
              <View className="flex-row items-center bg-[#1E2228] rounded-2xl px-3 py-2 border border-[#FFFFFF10]">
                <Ionicons name="search" size={18} color="#64748B" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search connections…"
                  placeholderTextColor="#64748B"
                  className="flex-1 ml-2 text-white text-[15px] py-1"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {loading ? (
              <View className="py-16 items-center">
                <ActivityIndicator color="#00E5FF" />
              </View>
            ) : contacts.length === 0 ? (
              <View className="py-12 px-6 items-center">
                <Ionicons name="people-outline" size={48} color="#333" />
                <Text className="text-white font-spaceBold mt-4">No eligible contacts</Text>
                <Text className="text-[#888] text-center mt-2 text-sm leading-5">
                  Follow creators, join projects, or connect on Network to unlock messaging.
                </Text>
              </View>
            ) : (
              <View className="px-4 pb-8">
                {contacts.map((c) => {
                  const un = cleanHandle(c.username) || "member";
                  const name = displayFullName(c.full_name, un);
                  const avatar =
                    c.avatar_url?.trim() ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0A0F12&color=70DAFF`;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => onSelect(c)}
                      className="flex-row items-center py-3 border-b border-[#FFFFFF08]"
                    >
                      <View className="relative">
                        <Image source={{ uri: avatar }} className="w-12 h-12 rounded-full" />
                        {c.is_online ? (
                          <View className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22C55E] border-2 border-black" />
                        ) : null}
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-white font-spaceBold text-sm">{name}</Text>
                        <Text className="text-[#888] text-xs">@{un}</Text>
                      </View>
                      <Text className="text-[#00E5FF] text-[10px] font-spaceBold">
                        {sourceLabel(c.source)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
