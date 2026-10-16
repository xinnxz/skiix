import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "skiix_analytics_";

export type AnalyticsEvent =
  | "shuffle_tap"
  | "shuffle_open"
  | "spark_open"
  | "spark_select"
  | "vibe_set"
  | "bookmark_save"
  | "bookmark_reminder"
  | "bookmark_calendar"
  | "bookmark_note"
  | "bookmark_workspace";

type Counters = Record<string, number>;

async function readCounters(): Promise<Counters> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}counters`);
    return raw ? (JSON.parse(raw) as Counters) : {};
  } catch {
    return {};
  }
}

async function writeCounters(counters: Counters): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PREFIX}counters`, JSON.stringify(counters));
  } catch {
    /* non-fatal */
  }
}

/** Lightweight client-side analytics for MVP feature funnels. */
export async function trackAnalytics(
  event: AnalyticsEvent,
  meta?: Record<string, string | number | boolean>,
): Promise<void> {
  const counters = await readCounters();
  counters[event] = (counters[event] ?? 0) + 1;
  if (meta?.category && typeof meta.category === "string") {
    const key = `${event}:${meta.category}`;
    counters[key] = (counters[key] ?? 0) + 1;
  }
  await writeCounters(counters);
  if (__DEV__) {
    console.debug("[analytics]", event, meta ?? {});
  }
}

export async function getAnalyticsSummary(): Promise<Counters> {
  return readCounters();
}
