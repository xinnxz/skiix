import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  exploreService,
  type ExploreCategoryId,
  type ExplorePage,
} from "@/services/exploreService";

/** Cursor-paginated explore grid filtered by category. */
export function useExploreGrid(category: ExploreCategoryId) {
  return useInfiniteQuery<ExplorePage>({
    queryKey: ["explore", category],
    queryFn: ({ pageParam }) =>
      exploreService.fetchExplore({
        category,
        cursor: (pageParam as string | null | undefined) ?? null,
      }),
    initialPageParam: null,
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 60_000,
  });
}

/** Returns a debounced value (useful for search input). */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/** Search across projects/users/posts. Disabled when query is empty. */
export function useSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["search", trimmed],
    queryFn: () => exploreService.search(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
  });
}
