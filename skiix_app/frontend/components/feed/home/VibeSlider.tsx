import React, { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { toast } from "sonner-native";
import { mvpFeaturesApi } from "@/utils/mvpFeatures.api";
import { trackAnalytics } from "@/utils/analytics";
import { useAuth } from "@/store/auth.store";
import type { HomeFeedPost } from "@/types/homeFeed.types";

const CYAN = "#00E5FF";
const MUTED = "#888888";

type Props = {
  post: HomeFeedPost;
  onPatch: (patch: Partial<HomeFeedPost>) => void;
};

function vibeLabel(score: number): string {
  if (score >= 75) return "Love It";
  if (score >= 25) return "Interesting";
  if (score > -25) return "Neutral";
  if (score > -75) return "Disagree";
  return "Strongly Disagree";
}

function vibeEmoji(score: number): string {
  if (score >= 50) return "❤️";
  if (score > -50) return "😐";
  return "👎";
}

export function VibeSlider({ post, onPatch }: Props) {
  const { session } = useAuth();
  const initial = post.viewer_vibe_score ?? 0;
  const [score, setScore] = useState(initial);
  const [saving, setSaving] = useState(false);

  const aggregates = useMemo(
    () => ({
      love: post.vibe_love_pct ?? 0,
      neutral: post.vibe_neutral_pct ?? 0,
      disagree: post.vibe_disagree_pct ?? 0,
      count: post.vibe_count ?? 0,
    }),
    [post.vibe_disagree_pct, post.vibe_love_pct, post.vibe_neutral_pct, post.vibe_count],
  );

  const commit = useCallback(
    async (next: number) => {
      if (!session?.access_token) {
        toast.error("Sign in to set a vibe.");
        setScore(initial);
        return;
      }
      setSaving(true);
      onPatch({ viewer_vibe_score: next });
      try {
        const res = await mvpFeaturesApi.setVibe(post.id, next);
        onPatch({
          viewer_vibe_score: res.vibe_score,
          vibe_love_pct: res.vibe_love_pct,
          vibe_neutral_pct: res.vibe_neutral_pct,
          vibe_disagree_pct: res.vibe_disagree_pct,
          avg_vibe_score: res.avg_vibe_score,
          vibe_count: res.vibe_count,
        });
        void trackAnalytics("vibe_set", { post_id: post.id });
      } catch {
        onPatch({ viewer_vibe_score: initial });
        setScore(initial);
        toast.error("Could not save vibe.");
      } finally {
        setSaving(false);
      }
    },
    [initial, onPatch, post.id, session?.access_token],
  );

  return (
    <View className="mt-3 pt-3 border-t border-[#FFFFFF12]">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-[#AAA] font-space text-xs">Vibe</Text>
        <Text className="text-white font-spaceBold text-xs">
          {vibeEmoji(score)} {vibeLabel(score)}
          {saving ? " …" : ""}
        </Text>
      </View>
      <Slider
        style={{ width: "100%", height: 32 }}
        minimumValue={-100}
        maximumValue={100}
        step={25}
        value={score}
        onValueChange={setScore}
        onSlidingComplete={(v) => void commit(Math.round(v))}
        minimumTrackTintColor={CYAN}
        maximumTrackTintColor="#333"
        thumbTintColor={CYAN}
      />
      <View className="flex-row justify-between">
        <Text style={{ color: MUTED, fontSize: 9 }}>-100</Text>
        <Text style={{ color: MUTED, fontSize: 9 }}>0</Text>
        <Text style={{ color: MUTED, fontSize: 9 }}>+100</Text>
      </View>
      {aggregates.count > 0 ? (
        <View className="flex-row flex-wrap gap-3 mt-2">
          <Text className="text-[#FF6B8A] font-space text-[10px]">❤️ Love {aggregates.love}%</Text>
          <Text className="text-[#AAA] font-space text-[10px]">😐 Neutral {aggregates.neutral}%</Text>
          <Text className="text-[#888] font-space text-[10px]">👎 Disagree {aggregates.disagree}%</Text>
        </View>
      ) : (
        <Text className="text-[#555] font-space text-[10px] mt-1">Be the first to set a vibe</Text>
      )}
    </View>
  );
}
