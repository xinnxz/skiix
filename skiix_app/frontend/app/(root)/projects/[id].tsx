import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/store/auth.store";
import {
  postDetailApi,
  type ProjectDetailDTO,
  type ProjectMemberDTO,
} from "@/utils/postDetail.api";
import { projectsApi } from "@/utils/projects.api";
import { cleanHandle } from "@/utils/displayIdentity";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const { user } = useAuth();
  const email = user?.email ?? "";

  const [project, setProject] = useState<ProjectDetailDTO | null>(null);
  const [members, setMembers] = useState<ProjectMemberDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  const load = useCallback(async () => {
    if (!projectId?.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [proj, mems] = await Promise.all([
        postDetailApi.getProject(projectId.trim()),
        postDetailApi.getProjectMembers(projectId.trim()).catch(() => [] as ProjectMemberDTO[]),
      ]);
      setProject(proj);
      setMembers(mems);
      setIsJoined(proj.is_joined);
    } catch (e) {
      if (__DEV__) console.error("[ProjectDetail]", e);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleJoin = async () => {
    if (!projectId || !email || joining || isJoined) return;
    setJoining(true);
    try {
      await projectsApi.join({
        user_email: email.toLowerCase(),
        project_id: projectId,
      });
      setIsJoined(true);
      Alert.alert("Joined!", `You are now a member of ${project?.title || "this project"}.`);
      void load();
    } catch {
      Alert.alert("Error", "Could not join project.");
    } finally {
      setJoining(false);
    }
  };

  const ownerHandle = cleanHandle(project?.owner_username ?? "");
  const hero = (project?.banner_url || project?.logo_url || "").trim();
  const isOwner = project?.is_owner ?? false;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {project?.title || "Project"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#00E5FF" size="large" />
        </View>
      ) : !project ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Project not found</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {hero ? (
            <Image source={{ uri: hero }} style={styles.banner} contentFit="cover" />
          ) : (
            <View style={[styles.banner, styles.logoBanner]}>
              <Text style={styles.logoInitials}>{project.title.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.projectInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.projectTitle}>{project.title}</Text>
              {project.category ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{project.category.toUpperCase()}</Text>
                </View>
              ) : null}
            </View>

            {project.description ? (
              <Text style={styles.description}>{project.description}</Text>
            ) : null}

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{project.member_count}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{project.posts_count}</Text>
                <Text style={styles.statLabel}>Updates</Text>
              </View>
            </View>

            <View style={styles.ownerRow}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
                onPress={() => ownerHandle && router.push(`/profile/${ownerHandle}`)}
              >
              {project.owner_avatar_url ? (
                <Image
                  source={{ uri: project.owner_avatar_url }}
                  style={styles.ownerAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.ownerAvatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>
                    {(ownerHandle || "U").slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.ownerName}>
                  {project.owner_full_name || ownerHandle || "Founder"}
                </Text>
                <Text style={styles.ownerUsername}>
                  {ownerHandle ? `@${ownerHandle}` : ""} · Founder
                </Text>
              </View>
              </TouchableOpacity>
              {project.owner_id && project.owner_id !== user?.id ? (
                <TouchableOpacity
                  style={styles.msgFounderBtn}
                  onPress={() =>
                    router.push({
                      pathname: "/messages/[id]",
                      params: {
                        id: "new",
                        userId: project.owner_id,
                        username: ownerHandle || "founder",
                        ...(project.owner_full_name
                          ? { fullName: encodeURIComponent(project.owner_full_name) }
                          : {}),
                        ...(project.owner_avatar_url
                          ? { avatarUrl: project.owner_avatar_url }
                          : {}),
                      },
                    } as never)
                  }
                >
                  <Ionicons name="chatbubble-outline" size={16} color="#00E5FF" />
                  <Text style={styles.msgFounderText}>Message Founder</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {!isOwner ? (
              <TouchableOpacity
                style={[styles.joinBtn, isJoined && styles.joinedBtn]}
                onPress={() => void handleJoin()}
                disabled={joining || isJoined}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Ionicons
                      name={isJoined ? "checkmark" : "rocket-outline"}
                      size={16}
                      color={isJoined ? "#22C55E" : "#000000"}
                    />
                    <Text style={[styles.joinBtnText, isJoined && styles.joinedBtnText]}>
                      {isJoined ? "Joined ✓" : "Join Project"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.ownerBadgeRow}>
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerBadgeText}>Your Project</Text>
                </View>
              </View>
            )}
          </View>

          {members.length > 0 ? (
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>Members ({project.member_count})</Text>
              {members.slice(0, 8).map((member) => {
                const mHandle = cleanHandle(member.username);
                const isMe = member.id === user?.id;
                return (
                  <View key={member.id} style={styles.memberRow}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
                    onPress={() => mHandle && router.push(`/profile/${mHandle}`)}
                  >
                    {member.avatar_url ? (
                      <Image
                        source={{ uri: member.avatar_url }}
                        style={styles.memberAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.memberAvatar, styles.avatarFallback]}>
                        <Text style={styles.avatarInitials}>
                          {(mHandle || "U").slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.full_name || mHandle}</Text>
                      {mHandle ? <Text style={styles.memberUsername}>@{mHandle}</Text> : null}
                    </View>
                    <View style={styles.memberRoleBadge}>
                      <Text style={styles.memberRoleText}>
                        {(member.project_role || "member").toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {!isMe ? (
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() =>
                        router.push({
                          pathname: "/messages/[id]",
                          params: {
                            id: "new",
                            userId: member.id,
                            username: mHandle || "member",
                            ...(member.full_name
                              ? { fullName: encodeURIComponent(member.full_name) }
                              : {}),
                            ...(member.avatar_url ? { avatarUrl: member.avatar_url } : {}),
                          },
                        } as never)
                      }
                    >
                      <Ionicons name="chatbubble-outline" size={20} color="#00E5FF" />
                    </TouchableOpacity>
                  ) : null}
                  </View>
                );
              })}
              {project.member_count > members.length ? (
                <Text style={styles.moreMembers}>
                  +{project.member_count - members.length} more members
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={{ height: 48 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F1F1F",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#888888", fontSize: 16 },
  banner: { width: "100%", height: 200 },
  logoBanner: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
  },
  logoInitials: { color: "#22C55E", fontSize: 36, fontWeight: "800" },
  projectInfo: { padding: 16 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  projectTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", flex: 1 },
  categoryBadge: {
    backgroundColor: "#1A1A1A",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#333333",
  },
  categoryText: { color: "#888888", fontSize: 10, fontWeight: "700" },
  description: { fontSize: 15, color: "#AAAAAA", lineHeight: 22, marginBottom: 16 },
  statsRow: { flexDirection: "row", gap: 24, marginBottom: 16 },
  stat: { alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  statLabel: { fontSize: 12, color: "#888888", marginTop: 2 },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#111111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  msgFounderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00E5FF44",
    backgroundColor: "#0A1A20",
  },
  msgFounderText: { color: "#00E5FF", fontSize: 11, fontWeight: "700" },
  ownerAvatar: { width: 40, height: 40, borderRadius: 999 },
  avatarFallback: {
    backgroundColor: "#1A3A4A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: "#00E5FF", fontSize: 13, fontWeight: "700" },
  ownerName: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  ownerUsername: { fontSize: 12, color: "#888888" },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#00E5FF",
    borderRadius: 14,
    height: 50,
    justifyContent: "center",
  },
  joinedBtn: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#22C55E",
  },
  joinBtnText: { color: "#000000", fontSize: 16, fontWeight: "800" },
  joinedBtnText: { color: "#22C55E" },
  ownerBadgeRow: { alignItems: "center", marginTop: 8 },
  ownerBadge: {
    backgroundColor: "#0A2010",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  ownerBadgeText: { color: "#22C55E", fontWeight: "700" },
  membersSection: { paddingHorizontal: 16, marginTop: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888888",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#0D0D0D",
  },
  memberAvatar: { width: 38, height: 38, borderRadius: 999 },
  memberName: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  memberUsername: { fontSize: 12, color: "#888888" },
  memberRoleBadge: {
    backgroundColor: "#111111",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  memberRoleText: { color: "#888888", fontSize: 9, fontWeight: "700" },
  moreMembers: {
    color: "#00E5FF",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
});
