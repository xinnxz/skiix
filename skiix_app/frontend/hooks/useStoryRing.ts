import { useQuery } from "@tanstack/react-query";
import { storiesApi } from "@/utils/stories.api";
import { storyRingKeys } from "@/utils/postCreation";

export function useStoryRing(email: string) {
  return useQuery({
    queryKey: storyRingKeys.list(email),
    queryFn: () => storiesApi.feedRing(email),
    enabled: Boolean(email),
    staleTime: 30_000,
  });
}
