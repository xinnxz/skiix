import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATIONS_KEY = "@skiix/settings/notifications";
const PRIVACY_KEY = "@skiix/settings/privacy";

export type NotificationSettings = {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  projectUpdates: boolean;
  storyReplies: boolean;
  mentions: boolean;
  marketing: boolean;
};

export type PrivacySettings = {
  privateAccount: boolean;
  showOnlineStatus: boolean;
  allowTagging: boolean;
  showActivity: boolean;
  allowDMs: "everyone" | "connections" | "nobody";
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  likes: true,
  comments: true,
  follows: true,
  messages: true,
  projectUpdates: true,
  storyReplies: true,
  mentions: true,
  marketing: false,
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  privateAccount: false,
  showOnlineStatus: true,
  allowTagging: true,
  showActivity: true,
  allowDMs: "connections",
};

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATIONS };
    return { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIFICATIONS };
  }
}

export async function saveNotificationSettings(s: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(s));
}

export async function loadPrivacySettings(): Promise<PrivacySettings> {
  try {
    const raw = await AsyncStorage.getItem(PRIVACY_KEY);
    if (!raw) return { ...DEFAULT_PRIVACY };
    return { ...DEFAULT_PRIVACY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRIVACY };
  }
}

export async function savePrivacySettings(s: PrivacySettings): Promise<void> {
  await AsyncStorage.setItem(PRIVACY_KEY, JSON.stringify(s));
}
