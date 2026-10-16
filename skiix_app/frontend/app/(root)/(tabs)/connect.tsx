import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/store/auth.store";
import { resolveDmPeerFromEmail } from "@/services/dmPeerResolve";
import { connectionsApi, ConnectionDTO } from "@/utils/connections.api";
import apiClient from "@/utils/axiosInstance";
import { Image as ExpoImage } from "expo-image";
import {
  fetchMyNetworkProjects,
  fetchNetworkProjectMembers,
  type NetworkProjectMemberRow,
  type NetworkProjectRow,
} from "@/services/networkProjects";
import { cleanHandle, displayFullName } from "@/utils/displayIdentity";

function otherParty(c: ConnectionDTO, me: string): string {
  const m = me.toLowerCase();
  return c.from_email.toLowerCase() === m ? c.to_email : c.from_email;
}

function pairsInvolving(all: ConnectionDTO[], me: string, other: string): ConnectionDTO[] {
  const o = other.toLowerCase();
  const m = me.toLowerCase();
  return all.filter(
    (c) =>
      (c.from_email.toLowerCase() === m && c.to_email.toLowerCase() === o) ||
      (c.from_email.toLowerCase() === o && c.to_email.toLowerCase() === m),
  );
}

function findBestConn(all: ConnectionDTO[], me: string, other: string): ConnectionDTO | undefined {
  const m = me.toLowerCase();
  const o = other.toLowerCase();
  const matches = pairsInvolving(all, me, other);
  const accepted = matches.find((c) => c.status === "accepted");
  if (accepted) return accepted;
  const inbound = matches.find(
    (c) => c.status === "pending" && c.from_email.toLowerCase() === o && c.to_email.toLowerCase() === m,
  );
  if (inbound) return inbound;
  const outbound = matches.find(
    (c) => c.status === "pending" && c.from_email.toLowerCase() === m && c.to_email.toLowerCase() === o,
  );
  if (outbound) return outbound;
  return matches[0];
}

type Kind = "accepted" | "pending_out" | "pending_in" | "none";

function classify(all: ConnectionDTO[], me: string, other: string): Kind {
  const c = findBestConn(all, me, other);
  if (!c) return "none";
  const m = me.toLowerCase();
  if (c.status === "accepted") return "accepted";
  if (c.status === "pending") return c.from_email.toLowerCase() === m ? "pending_out" : "pending_in";
  return "none";
}

function formatProjectRole(role: string) {
  const r = role.replace(/-/g, " ").trim();
  return r ? r.toUpperCase() : "MEMBER";
}

function formatUserRoleTag(tag: string) {
  const t = tag.replace(/_/g, " ").trim();
  if (!t || t.toLowerCase() === "member") return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

async function fetchFeedAuthorEmails(limit = 40): Promise<string[]> {
  try {
    const res = await apiClient.get<{ data: { author_email?: string }[] }>(
      "/api/v1/feed",
      { params: { limit, offset: 0 } },
    );
    const set = new Set<string>();
    for (const row of res.data.data ?? []) {
      const e = (row.author_email ?? "").trim().toLowerCase();
      if (e) set.add(e);
    }
    return [...set];
  } catch {
    return [];
  }
}

export default function ConnectScreen() {
  const { user, session } = useAuth();
  const email = (user?.email ?? "").trim().toLowerCase();
  const token = session?.access_token ?? "";
  const currentUserId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionDTO[]>([]);
  const [suggestedEmails, setSuggestedEmails] = useState<string[]>([]);
  const [busyPeer, setBusyPeer] = useState<string | null>(null);
  const [dmBusyEmail, setDmBusyEmail] = useState<string | null>(null);
  const [myProjects, setMyProjects] = useState<NetworkProjectRow[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [projectMembers, setProjectMembers] = useState<Record<string, NetworkProjectMemberRow[]>>({});

  const reload = useCallback(async () => {
    if (!email) {
      setConnections([]);
      setSuggestedEmails([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [conns, feedAuthors] = await Promise.all([
        connectionsApi.list(email),
        fetchFeedAuthorEmails(50),
      ]);
      setConnections(conns);

      let projects: NetworkProjectRow[] = [];
      if (session?.access_token) {
        try {
          projects = await fetchMyNetworkProjects(session.access_token);
        } catch {
          projects = [];
        }
      }
      setMyProjects(projects);

      const others = new Set<string>();
      for (const c of conns) others.add(otherParty(c, email).toLowerCase());
      for (const a of feedAuthors) others.add(a);
      others.delete(email);
      setSuggestedEmails([...others].sort());
    } catch {
      setConnections([]);
      setSuggestedEmails([]);
    } finally {
      setLoading(false);
    }
  }, [email, session?.access_token]);

  const fetchedMembersRef = useRef(new Set<string>());

  const fetchMembersForProject = useCallback(
    async (projectId: string) => {
      if (!token || fetchedMembersRef.current.has(projectId)) return;
      fetchedMembersRef.current.add(projectId);
      try {
        const rows = await fetchNetworkProjectMembers(token, projectId);
        setProjectMembers((prev) => ({ ...prev, [projectId]: rows }));
      } catch {
        fetchedMembersRef.current.delete(projectId);
        setProjectMembers((prev) => ({ ...prev, [projectId]: [] }));
      }
    },
    [token],
  );

  const handleProjectPress = useCallback(
    (projectId: string) => {
      setExpandedProject((prev) => {
        if (prev === projectId) return null;
        void fetchMembersForProject(projectId);
        return projectId;
      });
    },
    [fetchMembersForProject],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const acceptedCount = useMemo(
    () => connections.filter((c) => c.status === "accepted").length,
    [connections],
  );

  const openDm = async (peerEmail: string) => {
    const key = peerEmail.trim().toLowerCase();
    setDmBusyEmail(key);
    try {
      const r = await resolveDmPeerFromEmail(peerEmail);
      router.push({
        pathname: "/messages/[id]",
        params: {
          id: "new",
          ...(r.peerId ? { userId: r.peerId } : {}),
          username: r.username,
          ...(r.fullName ? { fullName: encodeURIComponent(r.fullName) } : {}),
          avatarUrl: r.avatarUrl ?? "",
          ...(!r.peerId ? { lookupEmail: encodeURIComponent(key) } : {}),
        },
      });
    } finally {
      setDmBusyEmail(null);
    }
  };

  const onConnect = async (peerEmail: string) => {
    if (!email) return;
    const peer = peerEmail.toLowerCase();
    setBusyPeer(peer);
    try {
      await connectionsApi.request(email, peer);
      await reload();
    } catch (e: any) {
      Alert.alert("Connect failed", String(e?.message ?? e));
    } finally {
      setBusyPeer(null);
    }
  };

  const onAccept = async (conn: ConnectionDTO) => {
    setBusyPeer(conn.id);
    try {
      await connectionsApi.accept(conn.id);
      await reload();
    } catch (e: any) {
      Alert.alert("Accept failed", String(e?.message ?? e));
    } finally {
      setBusyPeer(null);
    }
  };

  const subtitleFor = (peerEmail: string) => {
    const k = classify(connections, email, peerEmail);
    if (k === "accepted") return "You're connected · message anytime";
    if (k === "pending_out") return "Invite pending";
    if (k === "pending_in") return "Wants to connect with you";
    return "From your feed · connect to collaborate";
  };

  const renderActions = (peerEmail: string) => {
    const k = classify(connections, email, peerEmail);
    const conn = findBestConn(connections, email, peerEmail);
    const busy =
      busyPeer === peerEmail.toLowerCase() ||
      (conn && busyPeer === conn.id) ||
      dmBusyEmail === peerEmail.toLowerCase();

    if (!email) return null;

    if (k === "accepted") {
      return (
        <TouchableOpacity
          onPress={() => void openDm(peerEmail)}
          disabled={busy}
          activeOpacity={0.85}
          className="px-4 py-2 rounded-xl border border-[#FFFFFF33] bg-transparent"
        >
          <Text className="font-spaceBold text-[10px] uppercase text-[#FFFFFF99]">
            Message
          </Text>
        </TouchableOpacity>
      );
    }

    if (k === "pending_out") {
      return (
        <TouchableOpacity disabled className="px-4 py-2 rounded-xl border border-[#FFFFFF1A]">
          <Text className="font-spaceBold text-[10px] uppercase text-[#FFFFFF55]">
            Sent
          </Text>
        </TouchableOpacity>
      );
    }

    if (k === "pending_in" && conn) {
      return (
        <TouchableOpacity
          disabled={!!busyPeer}
          onPress={() => onAccept(conn)}
          activeOpacity={0.85}
          className="px-4 py-2 rounded-xl border border-[#00E5FF] bg-[#00E5FF20]"
        >
          <Text className="font-spaceBold text-[10px] uppercase text-[#00E5FF]">
            {busy ? "…" : "Accept"}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        disabled={!!busyPeer}
        onPress={() => onConnect(peerEmail)}
        activeOpacity={0.85}
        className="px-4 py-2 rounded-xl border border-[#00E5FF] bg-[#00E5FF20]"
      >
        <Text className="font-spaceBold text-[10px] uppercase text-[#00E5FF]">
          {busy ? "…" : "Connect"}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView edges={["top"]} className="flex-1">
        <View className="px-6 py-6">
          <Text className="text-white text-3xl font-spaceBold">Network</Text>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={!email}
            onPress={() => router.push("/connections-list")}
            className="mt-6 p-6 rounded-[32px] border border-[#00E5FF33] flex-row items-center justify-between"
            style={{ backgroundColor: "rgba(0, 229, 255, 0.05)" }}
          >
            <View>
              <Text className="text-[#00E5FF] font-spaceBold text-4xl">{acceptedCount}</Text>
              <Text className="text-[#94A3BB] font-space text-xs mt-1 uppercase tracking-widest">
                Total connections
              </Text>
              <Text className="text-[#FFFFFF44] font-space text-[10px] mt-2">
                Tap to view list · message or disconnect
              </Text>
            </View>
            <View className="bg-[#00E5FF] p-3 rounded-2xl shadow-lg shadow-cyan-500/50">
              <MaterialCommunityIcons name="transit-connection-variant" size={28} color="black" />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {!loading && email && token ? (
            myProjects.length > 0 ? (
              <View style={styles.projectsSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Active Projects</Text>
                  <Text style={styles.sectionCount}>{myProjects.length}</Text>
                </View>

                {myProjects.map((project) => {
                  const isExpanded = expandedProject === project.id;
                  const members = projectMembers[project.id];
                  const isOwner = project.owner_id === currentUserId;
                  const previewMembers = (members ?? []).slice(0, 5);

                  return (
                    <View key={project.id} style={styles.projectCard}>
                      <TouchableOpacity
                        style={styles.projectHeader}
                        onPress={() => handleProjectPress(project.id)}
                        activeOpacity={0.8}
                      >
                        {project.logo_url?.trim() ? (
                          <ExpoImage
                            source={{ uri: project.logo_url.trim() }}
                            style={styles.projectLogo}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.projectLogoFallback}>
                            <Text style={styles.projectLogoInitials}>
                              {(project.title || "PR").slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={{ flex: 1 }}>
                          <View style={styles.projectTitleRow}>
                            <Text style={styles.projectTitle} numberOfLines={1}>
                              {project.title || "Untitled project"}
                            </Text>
                            {isOwner ? (
                              <View style={styles.ownerBadge}>
                                <Text style={styles.ownerBadgeText}>OWNER</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.projectMeta}>
                            {project.category} · {project.member_count} member
                            {project.member_count !== 1 ? "s" : ""}
                          </Text>
                          <Text style={styles.myRoleBadge}>
                            My role: {formatProjectRole(project.my_role)}
                          </Text>

                          {previewMembers.length > 0 ? (
                            <View style={styles.avatarStackRow}>
                              {previewMembers.map((m) =>
                                m.avatar_url?.trim() ? (
                                  <ExpoImage
                                    key={m.id}
                                    source={{ uri: m.avatar_url.trim() }}
                                    style={styles.stackAvatar}
                                    contentFit="cover"
                                  />
                                ) : (
                                  <View key={m.id} style={[styles.stackAvatar, styles.stackAvatarFb]}>
                                    <Text style={styles.stackAvatarTxt}>
                                      {(m.username || "?").slice(0, 2).toUpperCase()}
                                    </Text>
                                  </View>
                                ),
                              )}
                              {project.member_count > previewMembers.length ? (
                                <View style={[styles.stackAvatar, styles.stackMore]}>
                                  <Text style={styles.stackMoreTxt}>
                                    +{project.member_count - previewMembers.length}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>

                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#666666"
                        />
                      </TouchableOpacity>

                      {isExpanded ? (
                        <View style={styles.membersContainer}>
                          <Text style={styles.membersTitle}>
                            Members ({project.member_count})
                          </Text>

                          {members === undefined ? (
                            <ActivityIndicator
                              size="small"
                              color="#00E5FF"
                              style={{ marginVertical: 10 }}
                            />
                          ) : (
                            members.map((member) => {
                              const memberHandle =
                                cleanHandle(member.username) || "member";
                              const memberTitle = displayFullName(
                                member.full_name,
                                memberHandle,
                              );
                              return (
                              <TouchableOpacity
                                key={member.id}
                                style={styles.memberRow}
                                onPress={() =>
                                  router.push({
                                    pathname: "/profile/[username]",
                                    params: { username: memberHandle },
                                  })
                                }
                              >
                                {member.avatar_url?.trim() ? (
                                  <ExpoImage
                                    source={{ uri: member.avatar_url.trim() }}
                                    style={styles.memberAvatar}
                                    contentFit="cover"
                                  />
                                ) : (
                                  <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
                                    <Text style={styles.memberInitials}>
                                      {memberTitle.slice(0, 2).toUpperCase()}
                                    </Text>
                                  </View>
                                )}

                                <View style={{ flex: 1 }}>
                                  <Text style={styles.memberName}>{memberTitle}</Text>
                                  <Text style={styles.memberUsername}>@{memberHandle}</Text>
                                </View>

                                <View style={styles.roleBadgesRow}>
                                  <View
                                    style={[
                                      styles.roleBadge,
                                      member.project_role === "owner" && styles.roleBadgeOwner,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.roleBadgeText,
                                        member.project_role === "owner" && styles.roleBadgeTextOwner,
                                      ]}
                                    >
                                      {formatProjectRole(member.project_role)}
                                    </Text>
                                  </View>

                                  {formatUserRoleTag(member.role_tag) ? (
                                    <View style={styles.userRoleBadge}>
                                      <Text style={styles.userRoleBadgeText}>
                                        {formatUserRoleTag(member.role_tag)}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                              </TouchableOpacity>
                            );
                            })
                          )}

                          <View style={styles.projectActions}>
                            <TouchableOpacity
                              style={styles.projectActionBtn}
                              onPress={() =>
                                router.push({
                                  pathname: "/projects/[id]",
                                  params: { id: project.id },
                                })
                              }
                            >
                              <Ionicons name="open-outline" size={16} color="#00E5FF" />
                              <Text style={styles.projectActionText}>View Project</Text>
                            </TouchableOpacity>

                            {isOwner ? (
                              <TouchableOpacity
                                style={styles.projectActionBtn}
                                onPress={() => router.push("/invite-collaborators")}
                              >
                                <Ionicons name="person-add-outline" size={16} color="#00E5FF" />
                                <Text style={styles.projectActionText}>Invite</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noProjects}>
                <Ionicons name="rocket-outline" size={36} color="#222222" />
                <Text style={styles.noProjectsText}>No active projects yet</Text>
                <TouchableOpacity
                  style={styles.createProjectBtn}
                  onPress={() => router.push("/create-project-update")}
                >
                  <Text style={styles.createProjectBtnText}>+ Start a Project</Text>
                </TouchableOpacity>
              </View>
            )
          ) : null}

          <View className="px-6 mb-4 flex-row justify-between items-center">
            <Text className="text-white font-spaceBold text-lg">People you may know</Text>
            <TouchableOpacity onPress={() => router.push("/connections-list")}>
              <Text className="text-[#00E5FF] font-space text-xs">Connections</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="py-16 items-center">
              <ActivityIndicator color="#00E5FF" />
            </View>
          ) : !email ? (
            <Text className="text-[#FFFFFF55] px-6">Sign in to see your network.</Text>
          ) : suggestedEmails.length === 0 ? (
            <Text className="text-[#FFFFFF55] px-6 mt-2 text-sm leading-6">
              No suggestions yet — post something or connect from the home feed first.
            </Text>
          ) : (
            <View className="px-6">
              {suggestedEmails.map((peerEmail) => {
                const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  peerEmail,
                )}&background=0A0F12&color=70DAFF`;
                const handle = `@${peerEmail.split("@")[0]}`;
                return (
                  <View
                    key={peerEmail}
                    className="flex-row items-center p-4 mb-4 rounded-3xl border border-[#FFFFFF1A]"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
                  >
                    <TouchableOpacity activeOpacity={0.85}>
                      <Image
                        source={{ uri: avatar }}
                        className="w-14 h-14 rounded-full border border-[#FFFFFF33]"
                      />
                    </TouchableOpacity>

                    <View className="flex-1 ml-4">
                      <Text className="text-white font-spaceBold text-base">{handle}</Text>
                      <Text className="text-[#94A3BB] font-space text-xs" numberOfLines={2}>
                        {subtitleFor(peerEmail)}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Ionicons name="sparkles-outline" size={12} color="#00E5FF" />
                        <Text className="text-[#00E5FF] font-space text-[10px] ml-1">
                          Skiix member
                        </Text>
                      </View>
                    </View>

                    {renderActions(peerEmail)}
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            disabled={!email}
            onPress={() => router.push("/invite-collaborators")}
            activeOpacity={0.88}
            className="mx-6 mt-4 p-5 rounded-3xl border border-dashed border-[#FFFFFF33] items-center flex-row justify-center bg-[#FFFFFF04]"
          >
            <Feather name="plus" size={20} color="#70DAFF" />
            <Text className="text-[#CBD5E1] font-spaceBold ml-2">Invite collaborators</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  projectsSection: {
    marginTop: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  sectionCount: {
    backgroundColor: "#00E5FF",
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  projectCard: {
    backgroundColor: "#111111",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F1F1F",
    marginBottom: 12,
    overflow: "hidden",
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  projectLogo: { width: 48, height: 48, borderRadius: 12 },
  projectLogoFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1A3A4A",
    alignItems: "center",
    justifyContent: "center",
  },
  projectLogoInitials: {
    color: "#00E5FF",
    fontSize: 16,
    fontWeight: "800",
  },
  projectTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  ownerBadge: {
    backgroundColor: "rgba(0,229,255,0.15)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#00E5FF",
  },
  ownerBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#00E5FF",
    letterSpacing: 0.5,
  },
  projectMeta: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  myRoleBadge: {
    fontSize: 11,
    color: "#00E5FF",
    marginTop: 2,
  },
  avatarStackRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  stackAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#111",
    marginRight: -10,
  },
  stackAvatarFb: {
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  stackAvatarTxt: { color: "#00E5FF", fontSize: 10, fontWeight: "700" },
  stackMore: {
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  stackMoreTxt: { color: "#888", fontSize: 10, fontWeight: "700" },
  membersContainer: {
    borderTopWidth: 1,
    borderTopColor: "#1F1F1F",
    padding: 14,
  },
  membersTitle: {
    fontSize: 12,
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
    marginBottom: 12,
  },
  memberAvatar: { width: 40, height: 40, borderRadius: 999 },
  memberAvatarFallback: {
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  memberInitials: {
    color: "#00E5FF",
    fontSize: 13,
    fontWeight: "700",
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  memberUsername: {
    fontSize: 12,
    color: "#888888",
    marginTop: 1,
  },
  roleBadgesRow: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  roleBadge: {
    backgroundColor: "#1A1A1A",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#333333",
  },
  roleBadgeOwner: {
    borderColor: "#00E5FF",
    backgroundColor: "#0D2A35",
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#888888",
    letterSpacing: 0.5,
  },
  roleBadgeTextOwner: { color: "#00E5FF" },
  userRoleBadge: {
    backgroundColor: "#1A0A2E",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#7B2FBE",
  },
  userRoleBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#7B2FBE",
    letterSpacing: 0.5,
  },
  projectActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    flexWrap: "wrap",
  },
  projectActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0D2A35",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#00E5FF",
  },
  projectActionText: {
    color: "#00E5FF",
    fontSize: 13,
    fontWeight: "600",
  },
  noProjects: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 10,
  },
  noProjectsText: {
    color: "#444444",
    fontSize: 15,
  },
  createProjectBtn: {
    backgroundColor: "#111111",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#00E5FF",
  },
  createProjectBtnText: {
    color: "#00E5FF",
    fontWeight: "700",
    fontSize: 14,
  },
});
