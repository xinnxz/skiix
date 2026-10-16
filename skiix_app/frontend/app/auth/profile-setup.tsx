import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Typography, BorderRadius } from "@/theme";
import { Button, Input } from "@/components/common";
import { useAuth } from "@/store/auth.store";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { toast } from "sonner-native";
import { usersApi } from "@/utils/user.api";
import { profileApi } from "@/utils/profile.api";
import { RolePickerModal } from "@/components/profile/RolePickerModal";
import {
  normalizeRoleId,
  type RoleId,
  getRoleLabel,
  roleById,
} from "@/constants/roles";

const handleRegex = /^[a-zA-Z0-9_]{3,32}$/;

const optionalString = (max = 120) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v ?? "").trim());

const schema = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only"),
  location: optionalString(80),
  tagline: optionalString(80),
  bio: z
    .string()
    .max(160, "Max 160 characters")
    .optional()
    .transform((v) => v ?? ""),
  website: optionalString(120).refine(
    (v) => v.length === 0 || /\.[a-z]{2,}/i.test(v),
    "Looks like an invalid URL",
  ),
  twitter: optionalString(40).refine(
    (v) => v.length === 0 || handleRegex.test(v.replace(/^@/, "")),
    "Invalid handle",
  ),
  linkedin: optionalString(120),
  github: optionalString(40).refine(
    (v) => v.length === 0 || handleRegex.test(v.replace(/^@/, "")),
    "Invalid handle",
  ),
});

type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, stage, saveProfile, isLoading, error, clearError } = useAuth();
  const [avatarUri, setAvatarUri] = useState<string | null>(
    user?.avatar_url ?? null,
  );
  const [roleTag, setRoleTag] = useState<RoleId | "">(
    normalizeRoleId(user?.role_tag) ?? "",
  );
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [usernameAvail, setUsernameAvail] = useState<Availability>("idle");
  const availTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditing = stage === "authed";

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormIn, any, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: user?.username ?? "",
      location: user?.location ?? "",
      tagline: user?.tagline ?? "",
      bio: user?.bio ?? "",
      website: user?.website_url ?? "",
      twitter: user?.twitter_handle ?? "",
      linkedin: user?.linkedin_url ?? "",
      github: user?.github_handle ?? "",
    },
  });

  const watchedUsername = watch("username");

  // Auto-detect location for first-time setup (skip while editing if present).
  useEffect(() => {
    if (isEditing && user?.location?.trim()) return;
    let mounted = true;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const geos = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const g = geos?.[0];
        const city = g?.city || g?.subregion || "";
        const region = g?.region || "";
        const country = g?.country || "";
        const loc = [city, region, country].filter(Boolean).join(", ").trim();
        if (mounted && loc) setValue("location", loc, { shouldDirty: false });
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setValue, isEditing, user?.location]);

  // Debounced username availability check.
  useEffect(() => {
    if (availTimer.current) clearTimeout(availTimer.current);
    const u = (watchedUsername ?? "").trim().toLowerCase();
    if (!u) {
      setUsernameAvail("idle");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(u)) {
      setUsernameAvail("invalid");
      return;
    }
    if (u === user?.username?.toLowerCase()) {
      setUsernameAvail("available");
      return;
    }
    setUsernameAvail("checking");
    availTimer.current = setTimeout(async () => {
      try {
        const ok = await profileApi.checkUsernameAvailable(u, user?.id);
        setUsernameAvail(ok ? "available" : "taken");
      } catch {
        setUsernameAvail("idle");
      }
    }, 500);
    return () => {
      if (availTimer.current) clearTimeout(availTimer.current);
    };
  }, [watchedUsername, user?.id, user?.username]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Photos permission denied");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (uri) setAvatarUri(uri);
  };

  const onSubmit = async (data: FormOut) => {
    clearError();
    if (usernameAvail === "taken") {
      toast.error("That username is taken");
      return;
    }
    try {
      let avatar_url: string | null = user?.avatar_url ?? null;
      if (avatarUri && avatarUri !== user?.avatar_url) {
        try {
          const filename = avatarUri.split("/").pop() || "avatar.jpg";
          const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
          const mime =
            ext === "png"
              ? "image/png"
              : ext === "webp"
                ? "image/webp"
                : "image/jpeg";
          const form = new FormData();
          // React Native FormData accepts the {uri, name, type} blob shape but
          // the DOM lib's `FormData.append` typings don't cover it.
          form.append("file", {
            uri: avatarUri,
            name: filename,
            type: mime,
          } as unknown as Blob);
          const res = await usersApi.uploadAvatar(form);
          avatar_url = res.avatar_url;
        } catch {
          avatar_url = avatarUri; // fallback to local uri so UI keeps showing it
        }
      }

      // 1) Persist core profile fields to Supabase user_metadata (immediate UI source).
      await saveProfile({
        username: data.username.toLowerCase(),
        bio: data.bio,
        avatar_url,
        location: data.location?.trim() ? data.location.trim() : null,
        tagline: data.tagline?.trim() ? data.tagline.trim() : null,
      });

      // 2) Best-effort sync of the full profile to the Go backend.
      try {
        await profileApi.updateMe({
          username: data.username.toLowerCase(),
          display_name: user?.display_name ?? "",
          avatar_url: avatar_url ?? "",
          bio: data.bio,
          location: data.location?.trim() ?? "",
          website: data.website?.trim() ?? "",
          twitter: data.twitter?.trim().replace(/^@/, "") ?? "",
          linkedin: data.linkedin?.trim() ?? "",
          github: data.github?.trim().replace(/^@/, "") ?? "",
          role_tag: roleTag,
        });
      } catch (e) {
        if (__DEV__) console.warn("[profile] backend sync failed", e);
      }

      toast.success(isEditing ? "Profile updated" : "Profile saved");

      if (isEditing) {
        router.back();
      } else {
        // First-time setup → continue into onboarding flow.
        router.replace("/(onboarding)/step1");
      }
    } catch {
      // store sets error
    }
  };

  const usernameStatus = (): { icon: string; color: string } | null => {
    switch (usernameAvail) {
      case "checking":
        return null;
      case "available":
        return { icon: "checkmark-circle", color: "#22C55E" };
      case "taken":
        return { icon: "close-circle", color: "#EF4444" };
      case "invalid":
        return { icon: "alert-circle", color: "#F59E0B" };
      default:
        return null;
    }
  };

  const status = usernameStatus();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bgBlack }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditing ? "Edit profile" : "Set up your profile"}
        </Text>
        <Text style={styles.subtitle}>
          {isEditing
            ? "Update your details, links, and role. Changes apply instantly."
            : "Add a public username, photo, and a short bio. You can change anything later."}
        </Text>

        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={pickAvatar}
          activeOpacity={0.85}
          accessibilityLabel="Change avatar"
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={34} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.avatarEdit}>
            <Ionicons name="camera" size={14} color={Colors.bgBlack} />
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change profile photo</Text>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={Colors.destructive}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Username + availability */}
        <Controller
          control={control}
          name="username"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <Input
                label="Username"
                placeholder="jane_skiix"
                value={value}
                onChangeText={(t) => onChange(t.toLowerCase())}
                onBlur={onBlur}
                autoCapitalize="none"
                leftIcon="at-outline"
                error={errors.username?.message}
              />
              <View style={styles.availRow}>
                {usernameAvail === "checking" ? (
                  <>
                    <ActivityIndicator size="small" color={Colors.textMuted} />
                    <Text style={styles.availChecking}>Checking…</Text>
                  </>
                ) : status ? (
                  <>
                    <Ionicons
                      name={status.icon as any}
                      size={14}
                      color={status.color}
                    />
                    <Text style={[styles.availText, { color: status.color }]}>
                      {usernameAvail === "available"
                        ? "Available"
                        : usernameAvail === "taken"
                          ? "Taken"
                          : "Invalid"}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          )}
        />

        {/* Role tag */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Role</Text>
          <Pressable
            onPress={() => setRoleSheetOpen(true)}
            style={({ pressed }) => [
              styles.rolePicker,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
          >
            {roleTag ? (
              <>
                <Ionicons
                  name={roleById(roleTag)?.icon ?? "person-outline"}
                  size={18}
                  color="#00E5FF"
                />
                <Text style={styles.roleLabel}>{getRoleLabel(roleTag)}</Text>
              </>
            ) : (
              <Text style={[styles.roleLabel, { color: Colors.textMuted }]}>
                Select your role
              </Text>
            )}
            <Ionicons
              name="chevron-down"
              size={18}
              color={Colors.textMuted}
              style={{ marginLeft: "auto" }}
            />
          </Pressable>
        </View>

        <Controller
          control={control}
          name="location"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Location"
              placeholder="San Francisco, CA"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              leftIcon="location-outline"
              error={errors.location?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="tagline"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Tagline"
              placeholder="Startup Founder & Product Strategist"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              leftIcon="sparkles-outline"
              error={errors.tagline?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="bio"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <Input
                label="Bio"
                placeholder="Tell people what you do…"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                leftIcon="text-outline"
                error={errors.bio?.message}
              />
              <Text style={styles.charCount}>
                {(value ?? "").length}/160
              </Text>
            </View>
          )}
        />

        <Text style={styles.sectionHeader}>Social Links</Text>

        <Controller
          control={control}
          name="website"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Website"
              placeholder="yoursite.com"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              leftIcon="globe-outline"
              autoCapitalize="none"
              keyboardType="url"
              error={errors.website?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="twitter"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Twitter / X"
              placeholder="handle"
              value={value}
              onChangeText={(t) => onChange(t.replace(/^@/, ""))}
              onBlur={onBlur}
              leftIcon="logo-twitter"
              autoCapitalize="none"
              error={errors.twitter?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="linkedin"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="LinkedIn"
              placeholder="linkedin.com/in/handle or handle"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              leftIcon="logo-linkedin"
              autoCapitalize="none"
              error={errors.linkedin?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="github"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="GitHub"
              placeholder="handle"
              value={value}
              onChangeText={(t) => onChange(t.replace(/^@/, ""))}
              onBlur={onBlur}
              leftIcon="logo-github"
              autoCapitalize="none"
              error={errors.github?.message}
            />
          )}
        />

        <Button
          label={isEditing ? "Save changes" : "Continue to Skiix"}
          onPress={handleSubmit(onSubmit)}
          variant="primary"
          size="lg"
          loading={isLoading}
          disabled={usernameAvail === "taken" || usernameAvail === "invalid"}
          style={{ marginTop: 16 }}
        />
      </ScrollView>

      <RolePickerModal
        visible={roleSheetOpen}
        currentRole={roleTag || null}
        onSelect={(id) => setRoleTag(id)}
        onClose={() => setRoleSheetOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    lineHeight: 22,
    marginBottom: 20,
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignSelf: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    backgroundColor: Colors.surface2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarEdit: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.bgBlack,
  },
  avatarHint: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    textAlign: "center",
    marginBottom: 10,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.destructiveMuted,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.destructive,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: Colors.destructive, fontSize: Typography.sm, flex: 1 },

  availRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
    minHeight: 16,
  },
  availChecking: { color: Colors.textMuted, fontSize: 12 },
  availText: { fontSize: 12, fontWeight: "500" },

  fieldBlock: { marginBottom: 16 },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    marginBottom: 6,
  },
  rolePicker: {
    backgroundColor: Colors.surface2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roleLabel: { color: Colors.textPrimary, fontSize: Typography.base },

  charCount: {
    alignSelf: "flex-end",
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: -8,
    marginBottom: 8,
  },

  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 12,
  },
});
