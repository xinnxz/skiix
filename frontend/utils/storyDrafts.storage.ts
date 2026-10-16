import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "skiix_story_drafts_v1";

export type StoryDraftStep = "capture" | "edit" | "details";

export type StoryDraft = {
  id: string;
  createdAt: number;
  updatedAt: number;
  localUri: string;
  mime: string;
  mediaKind: "image" | "video";
  caption: string;
  filterKey: string;
  step: StoryDraftStep;
};

async function loadAll(): Promise<StoryDraft[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoryDraft[]) : [];
  } catch {
    return [];
  }
}

async function persist(list: StoryDraft[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function listStoryDrafts(): Promise<StoryDraft[]> {
  const all = await loadAll();
  return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getStoryDraft(id: string): Promise<StoryDraft | null> {
  const all = await loadAll();
  return all.find((d) => d.id === id) ?? null;
}

export async function saveStoryDraft(payload: {
  id?: string;
  localUri: string;
  mime: string;
  mediaKind: "image" | "video";
  caption: string;
  filterKey: string;
  step: StoryDraftStep;
}): Promise<StoryDraft> {
  const all = await loadAll();
  const now = Date.now();
  const id = payload.id ?? `sd_${now}_${Math.random().toString(36).slice(2, 9)}`;
  const idx = all.findIndex((x) => x.id === id);
  const row: StoryDraft = {
    id,
    createdAt: idx >= 0 ? all[idx].createdAt : now,
    updatedAt: now,
    localUri: payload.localUri,
    mime: payload.mime,
    mediaKind: payload.mediaKind,
    caption: payload.caption,
    filterKey: payload.filterKey,
    step: payload.step,
  };
  if (idx >= 0) all[idx] = row;
  else all.push(row);
  await persist(all);
  return row;
}

export async function deleteStoryDraft(id: string) {
  const all = await loadAll();
  await persist(all.filter((x) => x.id !== id));
}
