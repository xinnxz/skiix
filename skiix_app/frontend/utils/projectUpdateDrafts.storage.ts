import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "skiix_project_update_drafts_v1";

export type ProjectUpdateDraftStep = "select" | "write" | "details" | "review";

export type ProjectUpdateDraft = {
  kind: "project_update";
  id: string;
  createdAt: number;
  updatedAt: number;
  step: ProjectUpdateDraftStep;
  selectedProjectId: string | null;
  selectedProjectLabel: string;
  newProjectName: string;
  searchQuery: string;
  body: string;
  tags: string[];
  milestonesEnabled: boolean;
  milestones: string[];
  pollEnabled: boolean;
  pollQuestion: string;
  pollOptions: string[];
  localMediaUri: string | null;
  localMediaMime: string | null;
  visibility: string;
};

async function loadAll(): Promise<ProjectUpdateDraft[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is ProjectUpdateDraft =>
        Boolean(x) && typeof x === "object" && (x as ProjectUpdateDraft).kind === "project_update",
    );
  } catch {
    return [];
  }
}

async function persist(list: ProjectUpdateDraft[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function listProjectUpdateDrafts(): Promise<ProjectUpdateDraft[]> {
  const all = await loadAll();
  return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProjectUpdateDraft(id: string): Promise<ProjectUpdateDraft | null> {
  const all = await loadAll();
  return all.find((d) => d.id === id) ?? null;
}

function blankRow(id: string, now: number): ProjectUpdateDraft {
  return {
    kind: "project_update",
    id,
    createdAt: now,
    updatedAt: now,
    step: "select",
    selectedProjectId: null,
    selectedProjectLabel: "",
    newProjectName: "",
    searchQuery: "",
    body: "",
    tags: [],
    milestonesEnabled: false,
    milestones: [""],
    pollEnabled: false,
    pollQuestion: "",
    pollOptions: ["", ""],
    localMediaUri: null,
    localMediaMime: null,
    visibility: "Everyone",
  };
}

export async function saveProjectUpdateDraft(
  patch: Partial<Omit<ProjectUpdateDraft, "kind" | "createdAt">> & {
    id?: string;
    step: ProjectUpdateDraftStep;
  },
): Promise<ProjectUpdateDraft> {
  const all = await loadAll();
  const now = Date.now();
  const id = patch.id ?? `pu_${now}_${Math.random().toString(36).slice(2, 9)}`;
  const idx = all.findIndex((x) => x.id === id);
  const prev = idx >= 0 ? all[idx] : blankRow(id, now);
  const next: ProjectUpdateDraft = {
    ...prev,
    ...patch,
    kind: "project_update",
    id,
    createdAt: prev.createdAt,
    updatedAt: now,
    tags: patch.tags ?? prev.tags,
    milestones: patch.milestones ?? prev.milestones,
    pollOptions: patch.pollOptions ?? prev.pollOptions,
  };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  await persist(all);
  return next;
}

export async function deleteProjectUpdateDraft(id: string) {
  const all = await loadAll();
  await persist(all.filter((x) => x.id !== id));
}
