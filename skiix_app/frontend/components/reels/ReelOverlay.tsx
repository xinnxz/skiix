import React from "react";
import { View, StyleSheet } from "react-native";
import { ReelInfo } from "./ReelInfo";
import { ReelSidebar } from "./ReelSidebar";
import type { ReelView } from "@/services/reelsService";

type Props = {
  reel: ReelView;
  bottomInset: number;
  onLike: () => void;
  onComment: () => void;
  onSave: () => void;
  onFollow: () => void;
  onShare: () => void;
  onAvatarPress?: () => void;
  onJoinProject?: () => void;
  onHashtagPress?: (tag: string) => void;
};

export function ReelOverlay({
  reel,
  bottomInset,
  onLike,
  onComment,
  onSave,
  onFollow,
  onShare,
  onAvatarPress,
  onJoinProject,
  onHashtagPress,
}: Props) {
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: bottomInset + 24 }]}
    >
      <View style={styles.row}>
        <ReelInfo reel={reel} onHashtagPress={onHashtagPress} />
        <ReelSidebar
          reel={reel}
          onLike={onLike}
          onComment={onComment}
          onSave={onSave}
          onFollow={onFollow}
          onShare={onShare}
          onAvatarPress={onAvatarPress}
          onJoinProject={onJoinProject}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
});
