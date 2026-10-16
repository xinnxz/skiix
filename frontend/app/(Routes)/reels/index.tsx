import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  FlatList,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  FontAwesome,
  MaterialCommunityIcons,
  Entypo,
} from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("screen");

const REELS = [
  {
    id: "1",
    user: "@alex_stark",
    role: "FOUNDER",
    title: "EcoTrack AI: Carbon\nCredits Simplified",
    description:
      "We're leveraging computer vision to track reforestation in real-time. Join the movement...",
    tags: "#ClimateTech #SaaS",
    likes: "12.4K",
    comments: "842",
    bookmarks: "3.1K",
    avatar: "https://i.pravatar.cc/150?u=9",
    videoBg: "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
  },
  {
    id: "2",
    user: "@sarah_dev",
    role: "ENGINEER",
    title: "Building the Future\nof Web3 Social",
    description:
      "Deep dive into decentralized identity protocols and why they matter for the next billion users.",
    tags: "#Web3 #Solidity",
    likes: "8.2K",
    comments: "430",
    bookmarks: "1.2K",
    avatar: "https://i.pravatar.cc/150?u=22",
    videoBg: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0",
  },
  {
    id: "3",
    user: "@marcus_j",
    role: "DESIGNER",
    title: "UI Trends 2026:\nBeyond Glassmorphism",
    description:
      "Exploring spatial interfaces and generative UI components in mobile apps.",
    tags: "#Design #UX",
    likes: "15.7K",
    comments: "1.1K",
    bookmarks: "5.4K",
    avatar: "https://i.pravatar.cc/150?u=33",
    videoBg: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
  },
];

export default function VideoPlayerScreen() {
  const insets = useSafeAreaInsets();

  const renderItem = ({ item }: { item: (typeof REELS)[0] }) => (
    <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }}>
      {/* 1. Background Media Layer */}
      <Image
        source={{ uri: item.videoBg }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      {/* 2. Gradient/Overlay Dimmer */}
      <View style={StyleSheet.absoluteFillObject} className="bg-black/30" />

      {/* 3. Metadata Overlay (Moves with Swipe) */}
      <View
        style={{
          flex: 1,
          paddingBottom: insets.bottom + 80, // Space for Bottom Tabs
          justifyContent: "flex-end",
        }}
      >
        <View className="flex-row items-end px-6">
          {/* Left Side: Info */}
          <View className="flex-1 mr-4">
            <View className="flex-row items-center mb-2">
              <Text className="text-white font-spaceBold text-lg shadow-sm">
                {item.user}
              </Text>
              <View className="bg-[#00E5FF20] px-2 py-0.5 rounded ml-2 border border-[#00E5FF]">
                <Text className="text-[#00E5FF] text-[10px] font-spaceBold uppercase">
                  {item.role}
                </Text>
              </View>
            </View>
            <Text className="text-white text-2xl font-spaceBold leading-tight shadow-md">
              {item.title}
            </Text>
            <Text
              className="text-[#FFFFFFCC] font-space text-sm mt-2"
              numberOfLines={2}
            >
              {item.description}
            </Text>
            <Text className="text-[#00E5FF] mt-2 font-spaceBold text-xs">
              {item.tags}
            </Text>
          </View>

          {/* Right Side: Interaction Sidebar */}
          <View className="items-center gap-y-6 mb-2">
            <View className="items-center">
              <Image
                source={{ uri: item.avatar }}
                className="w-12 h-12 rounded-full border-2 border-white"
              />
              <View className="absolute -bottom-2 bg-[#00E5FF] rounded-full border-2 border-black">
                <Ionicons name="add" size={14} color="black" />
              </View>
            </View>

            <TouchableOpacity className="items-center">
              <FontAwesome name="heart" size={30} color="white" />
              <Text className="text-white text-[10px] font-spaceBold mt-1">
                {item.likes}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center">
              <Ionicons name="chatbubble" size={30} color="white" />
              <Text className="text-white text-[10px] font-spaceBold mt-1">
                {item.comments}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center">
              <FontAwesome name="bookmark" size={30} color="white" />
              <Text className="text-white text-[10px] font-spaceBold mt-1">
                {item.bookmarks}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity className="bg-[#00E5FF] w-14 h-14 rounded-2xl items-center justify-center shadow-lg shadow-cyan-400">
              <MaterialCommunityIcons
                name="handshake"
                size={28}
                color="black"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" translucent />

      {/* ── FIXED TOP NAVIGATION (Does not move) ── */}
      <View
        style={{
          position: "absolute",
          top: insets.top,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
        className="flex-row justify-center items-center px-6 py-4"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute left-6 p-2"
        >
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>

        <View className="flex-row items-center gap-6">
          <TouchableOpacity>
            <Text className="text-white font-spaceBold text-base border-b-2 border-[#00E5FF] pb-1">
              For You
            </Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text className="text-[#FFFFFF99] font-spaceBold text-base pb-1">
              Following
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="absolute right-6 p-2">
          <Entypo name="dots-three-vertical" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* ── SWIPEABLE CONTENT ── */}
      <FlatList
        data={REELS}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        vertical
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        removeClippedSubviews={true}
        maxToRenderPerBatch={2}
        windowSize={3}
      />
    </View>
  );
}
