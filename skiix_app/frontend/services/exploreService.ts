// ============================================================
// EXPLORE / SEARCH SERVICE
//
// Talks to the Go backend's optional /api/v1/explore + /api/v1/search routes.
// Falls back to a local curated discovery set when the backend hasn't shipped
// those endpoints yet — the explore tab must always render something.
// ============================================================

import apiClient from "@/utils/axiosInstance";

export type ExploreCategoryId =
  | "all"
  | "ai-tech"
  | "design"
  | "web3"
  | "saas"
  | "fintech"
  | "growth"
  | "devtools"
  | "ventures"
  | "mobile"
  | "crypto"
  | "hardware";

export type ExploreCategory = { id: ExploreCategoryId; label: string };

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  { id: "all", label: "All" },
  { id: "ai-tech", label: "AI Tech" },
  { id: "design", label: "Design" },
  { id: "web3", label: "Web3" },
  { id: "saas", label: "SaaS" },
  { id: "fintech", label: "FinTech" },
  { id: "growth", label: "Growth" },
  { id: "devtools", label: "DevTools" },
  { id: "ventures", label: "Ventures" },
  { id: "mobile", label: "Mobile" },
  { id: "crypto", label: "Crypto" },
  { id: "hardware", label: "Hardware" },
];

export type ExploreCardType =
  | "project"
  | "topic"
  | "user"
  | "post"
  | "project_post"
  | "project_update";

export interface ExploreCard {
  id: string;
  title: string;
  image_url: string;
  category: ExploreCategoryId | "general";
  type: ExploreCardType;
  height: number;
  linked_id?: string;
  post_id?: string;
}

export interface ExplorePage {
  data: ExploreCard[];
  cursor: string | null;
}

export interface SearchResults {
  projects: Array<{
    id: string;
    title: string;
    description: string;
    logo_url: string | null;
    category: string;
    members?: number;
  }>;
  users: Array<{
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    role_tag: string | null;
    followers?: number;
  }>;
  posts: Array<{
    id: string;
    content: string;
    media_url: string | null;
    type: string;
    author_name?: string;
    created_at?: string;
  }>;
}

// ─── Local discovery fallback (used when API is missing/404) ───────────────

const ALTERNATING_HEIGHTS = [260, 180, 220, 280, 200, 240];

const LOCAL_DISCOVERY: Array<Omit<ExploreCard, "height">> = [
  {
    id: "loc-1",
    title: "NEURAL UI",
    image_url:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600",
    category: "design",
    type: "topic",
  },
  {
    id: "loc-2",
    title: "WEB3 NODES",
    image_url:
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600",
    category: "web3",
    type: "topic",
  },
  {
    id: "loc-3",
    title: "HARDWARE",
    image_url:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600",
    category: "hardware",
    type: "topic",
  },
  {
    id: "loc-4",
    title: "GRADIENTS",
    image_url:
      "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=600",
    category: "design",
    type: "topic",
  },
  {
    id: "loc-5",
    title: "AI AGENTS",
    image_url:
      "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600",
    category: "ai-tech",
    type: "topic",
  },
  {
    id: "loc-6",
    title: "FINTECH",
    image_url:
      "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=600",
    category: "fintech",
    type: "topic",
  },
  {
    id: "loc-7",
    title: "DEVTOOLS",
    image_url:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600",
    category: "devtools",
    type: "topic",
  },
  {
    id: "loc-8",
    title: "GROWTH",
    image_url:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600",
    category: "growth",
    type: "topic",
  },
  {
    id: "loc-9",
    title: "MOBILE",
    image_url:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600",
    category: "mobile",
    type: "topic",
  },
  {
    id: "loc-10",
    title: "CRYPTO",
    image_url:
      "https://images.unsplash.com/photo-1639762681057-408e52192e55?w=600",
    category: "crypto",
    type: "topic",
  },
  {
    id: "loc-11",
    title: "SAAS",
    image_url:
      "https://images.unsplash.com/photo-1551434678-e076c223a692?w=600",
    category: "saas",
    type: "topic",
  },
  {
    id: "loc-12",
    title: "VENTURES",
    image_url:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600",
    category: "ventures",
    type: "topic",
  },
];

function withMasonryHeights(cards: Omit<ExploreCard, "height">[]): ExploreCard[] {
  return cards.map((card, idx) => ({
    ...card,
    height: ALTERNATING_HEIGHTS[idx % ALTERNATING_HEIGHTS.length],
  }));
}

function localDiscovery(
  category: ExploreCategoryId,
  cursor: number | null,
  limit = 20,
): ExplorePage {
  const start = cursor ?? 0;
  const filtered =
    category === "all"
      ? LOCAL_DISCOVERY
      : LOCAL_DISCOVERY.filter((c) => c.category === category);
  const slice = filtered.slice(start, start + limit);
  const nextStart = start + slice.length;
  return {
    data: withMasonryHeights(slice),
    cursor: nextStart < filtered.length ? String(nextStart) : null,
  };
}

// ─── API ────────────────────────────────────────────────────────────────────

export const exploreService = {
  async fetchExplore(params: {
    category: ExploreCategoryId;
    cursor?: string | null;
    limit?: number;
  }): Promise<ExplorePage> {
    try {
      const res = await apiClient.get<ExplorePage>("/api/v1/explore", {
        params: {
          category: params.category,
          // Only forward a real cursor — the backend treats "" as "first page".
          ...(params.cursor ? { cursor: params.cursor } : null),
          limit: params.limit ?? 20,
        },
      });
      const body = res.data;
      // Treat any well-formed `{data:[]}` as authoritative — the backend
      // really has nothing for this category yet, so we want the empty state.
      // We only fall back to local discovery when the request itself fails
      // (network unreachable, 404, etc.) AND we don't have a cursor — pagination
      // failures should bubble up as "no more" rather than restart from canned data.
      if (body && Array.isArray(body.data)) {
        const normalized = body.data.map((card, idx) => ({
          ...card,
          height:
            typeof card.height === "number" && card.height > 0
              ? card.height
              : ALTERNATING_HEIGHTS[idx % ALTERNATING_HEIGHTS.length],
        }));
        return { data: normalized, cursor: body.cursor ?? null };
      }
      throw new Error("malformed");
    } catch {
      if (params.cursor) {
        return { data: [], cursor: null };
      }
      return localDiscovery(params.category, 0, params.limit);
    }
  },

  async search(query: string): Promise<SearchResults> {
    const empty: SearchResults = { projects: [], users: [], posts: [] };
    if (!query.trim()) return empty;
    try {
      const res = await apiClient.get<{ data: SearchResults }>(
        "/api/v1/search",
        { params: { q: query.trim(), type: "all", limit: 20 } },
      );
      return res.data?.data ?? empty;
    } catch {
      return empty;
    }
  },
};
