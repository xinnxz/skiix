import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = width / 2 - 24;

const TRENDING_CHIPS = ["All", "AI Tech", "Design", "Web3", "Climate", "SaaS"];

const EXPLORE_ITEMS = [
  {
    id: "1",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
    title: "Neural UI",
    height: 200,
  },
  {
    id: "2",
    image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0",
    title: "Web3 nodes",
    height: 280,
  },
  {
    id: "3",
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f",
    title: "Hardware",
    height: 240,
  },
  {
    id: "4",
    image: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400",
    title: "Gradients",
    height: 200,
  },
  {
    id: "5",
    image: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e",
    title: "Abstract",
    height: 260,
  },
  {
    id: "6",
    image: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d",
    title: "Minimal",
    height: 220,
  },
];

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* ── SEARCH HEADER ── */}
        <View className="px-6 py-4">
          <View
            className="flex-row items-center px-4 h-14 rounded-2xl border border-[#FFFFFF1A]"
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            <Feather name="search" size={20} color="#70DAFF" />
            <TextInput
              className="flex-1 ml-3 text-white font-space text-base"
              placeholder="Search builders, projects..."
              placeholderTextColor="#FFFFFF4D"
              value={searchQuery}
              onChangeText={setSearchQuery}
              selectionColor="#00E5FF"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#FFFFFF4D" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* ── TRENDING CHIPS ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="pl-6 mb-8"
          >
            {TRENDING_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                onPress={() => setActiveTab(chip)}
                className={`mr-3 px-6 py-2.5 rounded-full border ${
                  activeTab === chip
                    ? "bg-[#00E5FF] border-[#00E5FF]"
                    : "bg-transparent border-[#FFFFFF1A]"
                }`}
              >
                <Text
                  className={`font-spaceBold text-xs ${
                    activeTab === chip ? "text-black" : "text-[#FFFFFF99]"
                  }`}
                >
                  {chip}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── EXPLORE GRID ── */}
          <View className="px-6 flex-row justify-between">
            {/* Left Column */}
            <View>
              {EXPLORE_ITEMS.filter((_, i) => i % 2 === 0).map((item) => (
                <ExploreCard key={item.id} item={item} />
              ))}
            </View>

            {/* Right Column */}
            <View>
              {EXPLORE_ITEMS.filter((_, i) => i % 2 !== 0).map((item) => (
                <ExploreCard key={item.id} item={item} />
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ExploreCard({ item }: { item: (typeof EXPLORE_ITEMS)[0] }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      className="mb-4 rounded-3xl overflow-hidden border border-[#FFFFFF1A]"
      style={{ width: COLUMN_WIDTH, height: item.height }}
    >
      <Image
        source={{ uri: item.image }}
        className="w-full h-full"
        resizeMode="cover"
      />

      {/* Overlay Label (No Blur Implementation) */}
      <View className="absolute bottom-0 left-0 right-0 p-3">
        <View
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
          className="px-3 py-1.5 rounded-xl self-start border border-[#FFFFFF26]"
        >
          <Text className="text-white font-spaceBold text-[10px] tracking-widest uppercase">
            {item.title}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
