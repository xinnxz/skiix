import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "skiix_text_drafts_v1";

export type TextDraftStep = "compose" | "details" | "review";

export type TextDraft = {
  id: string;
  createdAt: number;
  updatedAt: number;
  body: string;
  step: TextDraftStep;
  allowComments: boolean;
  allowShares: boolean;
};

async function loadAll(): Promise<TextDraft[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TextDraft[]) : [];
  } catch {
    return [];
  }
}

async function persist(list: TextDraft[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function listTextDrafts(): Promise<TextDraft[]> {
  const all = await loadAll();
  return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getTextDraft(id: string): Promise<TextDraft | null> {
  const all = await loadAll();
  return all.find((d) => d.id === id) ?? null;
}

export async function saveTextDraft(payload: {
  id?: string;
  body: string;
  step: TextDraftStep;
  allowComments?: boolean;
  allowShares?: boolean;
}): Promise<TextDraft> {
  const all = await loadAll();
  const now = Date.now();
  const id = payload.id ?? `td_${now}_${Math.random().toString(36).slice(2, 9)}`;
  const idx = all.findIndex((x) => x.id === id);
  const row: TextDraft = {
    id,
    createdAt: idx >= 0 ? all[idx].createdAt : now,
    updatedAt: now,
    body: payload.body,
    step: payload.step,
    allowComments: payload.allowComments ?? (idx >= 0 ? all[idx].allowComments : true),
    allowShares: payload.allowShares ?? (idx >= 0 ? all[idx].allowShares : true),
  };
  if (idx >= 0) all[idx] = row;
  else all.push(row);
  await persist(all);
  return row;
}

export async function deleteTextDraft(id: string) {
  const all = await loadAll();
  await persist(all.filter((x) => x.id !== id));
}
