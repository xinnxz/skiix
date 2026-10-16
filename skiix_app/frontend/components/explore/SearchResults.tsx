import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { SearchResults as SearchResultsT } from "@/services/exploreService";

const TOKENS = {
  card: "#111111",
  border: "#1F1F1F",
  cyan: "#00E5FF",
  text: "#FFFFFF",
  textMuted: "#888888",
  chevron: "#444444",
  placeholderBg: "#1A1A1A",
};

type Props = {
  query: string;
  results: SearchResultsT | undefined;
  isLoading: boolean;
  onSelectProject?: (id: string) => void;
  onSelectUser?: (username: string) => void;
  onSelectPost?: (id: string) => void;
};

export function SearchResultsList({
  query,
  results,
  isLoading,
  onSelectProject,
  onSelectUser,
  onSelectPost,
}: Props) {
  const projects = results?.projects ?? [];
  const users = results?.users ?? [];
  const posts = results?.posts ?? [];
  const total = projects.length + users.length + posts.length;

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={TOKENS.cyan} />
      </View>
    );
  }

  if (total === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="search-outline" size={48} color="#333333" />
        <Text style={styles.emptyTitle}>No results for "{query}"</Text>
        <Text style={styles.emptySub}>Try different keywords</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {projects.length > 0 ? (
        <View>
          <Text style={styles.sectionLabel}>Projects ({projects.length})</Text>
          {projects.map((p) => (
            <TouchableOpacity
              key={`p-${p.id}`}
              onPress={() => onSelectProject?.(p.id)}
              activeOpacity={0.85}
              style={styles.row}
            >
              <View style={styles.avatar}>
                {p.logo_url ? (
                  <Image
                    source={{ uri: p.logo_url }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons name="cube-outline" size={20} color={TOKENS.cyan} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {p.title}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {p.category}
                  {typeof p.members === "number"
                    ? ` · ${p.members} members`
                    : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TOKENS.chevron} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {users.length > 0 ? (
        <View>
          <Text style={styles.sectionLabel}>People ({users.length})</Text>
          {users.map((u) => (
            <TouchableOpacity
              key={`u-${u.id}`}
              onPress={() => onSelectUser?.(u.username)}
              activeOpacity={0.85}
              style={styles.row}
            >
              <View style={styles.avatar}>
                {u.avatar_url ? (
                  <Image
                    source={{ uri: u.avatar_url }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons name="person-outline" size={20} color={TOKENS.cyan} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  @{u.username}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {u.role_tag ?? u.full_name ?? "Skiix user"}
                  {typeof u.followers === "number"
                    ? ` · ${u.followers} followers`
                    : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TOKENS.chevron} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {posts.length > 0 ? (
        <View>
          <Text style={styles.sectionLabel}>Posts ({posts.length})</Text>
          {posts.map((p) => (
            <TouchableOpacity
              key={`po-${p.id}`}
              onPress={() => onSelectPost?.(p.id)}
              activeOpacity={0.85}
              style={styles.row}
            >
              <View style={styles.avatar}>
                {p.media_url ? (
                  <Image
                    source={{ uri: p.media_url }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={20}
                    color={TOKENS.cyan}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {p.content}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {p.author_name ?? "Skiix"}
                  {p.created_at ? ` · ${p.created_at}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TOKENS.chevron} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 80 },
  loadingWrap: {
    paddingTop: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    paddingTop: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: TOKENS.text,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  emptySub: { color: TOKENS.textMuted, fontSize: 13 },
  sectionLabel: {
    color: TOKENS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: TOKENS.placeholderBg,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: TOKENS.text, fontSize: 15, fontWeight: "600" },
  rowSub: { color: TOKENS.textMuted, fontSize: 13, marginTop: 2 },
});
