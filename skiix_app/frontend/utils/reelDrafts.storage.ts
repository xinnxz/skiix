import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "skiix_reel_drafts_v1";

export type ReelDraftStep = "select" | "edit" | "details";

export type ReelDraft = {
  id: string;
  createdAt: number;
  updatedAt: number;
  localUri: string;
  mime?: string;
  caption: string;
  hashtags: string;
  step: ReelDraftStep;
};

async function loadAll(): Promise<ReelDraft[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ReelDraft[]) : [];
  } catch {
    return [];
  }
}

async function persist(list: ReelDraft[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function listReelDrafts(): Promise<ReelDraft[]> {
  const all = await loadAll();
  return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getReelDraft(id: string): Promise<ReelDraft | null> {
  const all = await loadAll();
  return all.find((d) => d.id === id) ?? null;
}

export async function saveReelDraft(
  draft: {
    id?: string;
    localUri: string;
    mime?: string;
    caption: string;
    hashtags: string;
    step: ReelDraftStep;
  },
): Promise<ReelDraft> {
  const all = await loadAll();
  const now = Date.now();
  const id = draft.id ?? `rd_${now}_${Math.random().toString(36).slice(2, 9)}`;
  const idx = all.findIndex((x) => x.id === id);
  const row: ReelDraft = {
    id,
    createdAt: idx >= 0 ? all[idx].createdAt : now,
    updatedAt: now,
    localUri: draft.localUri,
    mime: draft.mime,
    caption: draft.caption,
    hashtags: draft.hashtags,
    step: draft.step,
  };
  if (idx >= 0) all[idx] = row;
  else all.push(row);
  await persist(all);
  return row;
}

export async function deleteReelDraft(id: string) {
  const all = await loadAll();
  await persist(all.filter((x) => x.id !== id));
}
