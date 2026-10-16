import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

const MESSAGES = [
  {
    id: "1",
    text: "Hey Alex! Just saw your new post about the neural architecture.",
    sender: "other",
    time: "10:00 AM",
  },
  {
    id: "2",
    text: "It looks incredible. Are you still looking for beta testers?",
    sender: "other",
    time: "10:00 AM",
  },
  {
    id: "3",
    text: "Thanks Sarah! Yes, we have two spots left. Would you like to join the cohort?",
    sender: "me",
    time: "10:02 AM",
  },
  {
    id: "4",
    text: "Absolutely. Let me know what you need from my side.",
    sender: "other",
    time: "10:05 AM",
  },
  {
    id: "5",
    text: "Just sent over the onboarding link to your email! 🚀",
    sender: "me",
    time: "10:07 AM",
  },
];

export default function ChatScreen() {
  const [message, setMessage] = useState("");

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* ── CHAT HEADER ── */}
        <View className="flex-row items-center px-6 py-4 border-b border-[#FFFFFF0D]">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Feather name="chevron-left" size={28} color="white" />
          </TouchableOpacity>

          <View className="flex-row flex-1 items-center">
            <View>
              <Image
                source={{ uri: "https://i.pravatar.cc/150?u=22" }}
                className="w-10 h-10 rounded-full"
              />
              <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
            </View>
            <View className="ml-3">
              <Text className="text-white font-spaceBold text-base">
                Sarah Jenkins
              </Text>
              <Text className="text-[#00E5FF] font-space text-[10px] uppercase tracking-tighter">
                Active Now
              </Text>
            </View>
          </View>

          <View className="flex-row gap-5">
            <TouchableOpacity>
              <Feather name="phone" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity>
              <Feather name="video" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── MESSAGES AREA ── */}
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingVertical: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {MESSAGES.map((msg) => {
            const isMe = msg.sender === "me";
            return (
              <View
                key={msg.id}
                className={`mb-6 flex-row ${isMe ? "justify-end" : "justify-start"}`}
              >
                <View
                  className={`max-w-[80%] p-4 rounded-[24px] ${
                    isMe
                      ? "bg-[#00E5FF] rounded-tr-none"
                      : "bg-[#FFFFFF0D] border border-[#FFFFFF1A] rounded-tl-none"
                  }`}
                >
                  <Text
                    className={`font-space text-sm leading-5 ${isMe ? "text-black" : "text-[#FFFFFFE5]"}`}
                  >
                    {msg.text}
                  </Text>
                  <Text
                    className={`text-[9px] mt-1 font-spaceBold opacity-50 ${isMe ? "text-black text-right" : "text-white"}`}
                  >
                    {msg.time}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* ── INPUT BAR ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <View className="px-6 py-4 bg-black border-t border-[#FFFFFF0D]">
            <View
              className="flex-row items-center px-4 h-14 rounded-2xl border border-[#FFFFFF1A]"
              style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
            >
              <TouchableOpacity className="mr-3">
                <Ionicons name="add" size={24} color="#00E5FF" />
              </TouchableOpacity>

              <TextInput
                className="flex-1 text-white font-space text-sm"
                placeholder="Type a message..."
                placeholderTextColor="#FFFFFF4D"
                value={message}
                onChangeText={setMessage}
                multiline
              />

              <TouchableOpacity
                disabled={!message}
                className={`ml-3 p-2 rounded-xl ${message ? "bg-[#00E5FF]" : "bg-transparent"}`}
              >
                <Feather
                  name="send"
                  size={18}
                  color={message ? "black" : "#FFFFFF4D"}
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
