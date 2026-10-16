import { create } from "zustand";

export type ReelsTab = "for-you" | "following";

interface ReelsState {
  activeIndex: number;
  isMuted: boolean;
  activeTab: ReelsTab;
  setActiveIndex: (index: number) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  setActiveTab: (tab: ReelsTab) => void;
}

/**
 * Local UI state for the reels screen — kept out of TanStack Query so
 * scrolling does not touch the network cache.
 */
export const useReelsStore = create<ReelsState>((set) => ({
  activeIndex: 0,
  isMuted: false,
  activeTab: "for-you",
  setActiveIndex: (index) => set({ activeIndex: index }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setMuted: (muted) => set({ isMuted: muted }),
  setActiveTab: (tab) => set({ activeTab: tab, activeIndex: 0 }),
}));
