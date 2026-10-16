import React from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { SectionHeader } from "./SectionHeader";

export type SocialLinksProps = {
  twitter?: string | null;
  linkedin?: string | null;
  github?: string | null;
  website?: string | null;
};

type Row = {
  key: string;
  label: string;
  url: string;
  icon: React.ReactNode;
};

/** Normalize a handle/URL to an absolute https:// URL for `Linking.openURL`. */
function normalizeUrl(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}

function buildRows(p: SocialLinksProps): Row[] {
  const rows: Row[] = [];
  if (p.twitter && p.twitter.trim()) {
    const handle = p.twitter.trim().replace(/^@/, "");
    rows.push({
      key: "twitter",
      label: `@${handle}`,
      url: `https://twitter.com/${handle}`,
      icon: <FontAwesome5 name="twitter" size={16} color="#1DA1F2" />,
    });
  }
  if (p.linkedin && p.linkedin.trim()) {
    const v = p.linkedin.trim();
    const url = /^https?:\/\//i.test(v) ? v : `https://linkedin.com/in/${v.replace(/^@/, "")}`;
    rows.push({
      key: "linkedin",
      label: v.replace(/^https?:\/\//i, ""),
      url,
      icon: <FontAwesome5 name="linkedin" size={16} color="#0A66C2" />,
    });
  }
  if (p.github && p.github.trim()) {
    const handle = p.github.trim().replace(/^@/, "");
    const url = /^https?:\/\//i.test(handle) ? handle : `https://github.com/${handle}`;
    rows.push({
      key: "github",
      label: `github.com/${handle.replace(/^https?:\/\/github\.com\//i, "")}`,
      url,
      icon: <FontAwesome5 name="github" size={16} color="#FFFFFF" />,
    });
  }
  if (p.website && p.website.trim()) {
    const url = normalizeUrl(p.website);
    rows.push({
      key: "website",
      label: url.replace(/^https?:\/\//i, ""),
      url,
      icon: <Ionicons name="globe-outline" size={16} color="#00E5FF" />,
    });
  }
  return rows;
}

export function SocialLinks(props: SocialLinksProps) {
  const rows = buildRows(props);
  if (rows.length === 0) return null;

  const open = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("Cannot open link");
      await Linking.openURL(url);
    } catch (e: any) {
      toast.error(String(e?.message ?? "Could not open link."));
    }
  };

  return (
    <View style={styles.card}>
      <SectionHeader title="Social Links" />

      <View style={{ gap: 10 }}>
        {rows.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => open(r.url)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            accessibilityRole="link"
            accessibilityLabel={`Open ${r.key}: ${r.label}`}
          >
            <View style={styles.iconWrap}>{r.icon}</View>
            <Text style={styles.text} numberOfLines={1}>
              {r.label}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#444444" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  iconWrap: { width: 22, alignItems: "center" },
  text: { color: "#FFFFFF", fontSize: 14, flex: 1 },
});
