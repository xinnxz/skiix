import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
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
import { usersApi } from "@/utils/user.api";
import * as Location from "expo-location";

const schema = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only"),
  location: z.string().max(80).optional().default(""),
  tagline: z.string().max(80).optional().default(""),
  bio: z.string().max(700).optional().default(""),
});

type Form = z.infer<typeof schema>;

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { saveProfile, isLoading, error, clearError } = useAuth();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", location: "", tagline: "", bio: "" },
  });

  React.useEffect(() => {
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
  }, [setValue]);

  const onSubmit = async (data: Form) => {
    clearError();
    try {
      let avatar_url: string | null = null;

      if (avatarUri) {
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
          form.append("file", {
            // @ts-expect-error React Native FormData file type
            uri: avatarUri,
            name: filename,
            type: mime,
          });

          const res = await usersApi.uploadAvatar(form);
          avatar_url = res.avatar_url;
        } catch {
          // If upload fails (backend not configured yet), continue without blocking profile creation.
          avatar_url = null;
        }
      }

      await saveProfile({
        username: data.username.toLowerCase(),
        bio: data.bio,
        avatar_url,
        location: data.location?.trim() ? data.location.trim() : null,
        tagline: data.tagline?.trim() ? data.tagline.trim() : null,
      });
      // Continue into personalize feed step (matches product UI).
      router.replace("/personalize");
    } catch {
      // store sets error
    }
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bgBlack }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>
          Add a public username and a short bio. You can change these later.
        </Text>

        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={pickAvatar}
          activeOpacity={0.85}
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
        <Text style={styles.avatarHint}>Add profile photo (optional)</Text>

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
        <Controller
          control={control}
          name="username"
          render={({ field: { onChange, onBlur, value } }) => (
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
          )}
        />
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
            <Input
              label="Professional bio"
              placeholder="Tell people what you do…"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              leftIcon="text-outline"
              error={errors.bio?.message}
            />
          )}
        />
        <Button
          label="Continue to Skiix"
          onPress={handleSubmit(onSubmit)}
          variant="primary"
          size="lg"
          loading={isLoading}
          style={{ marginTop: 12 }}
        />
      </ScrollView>
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
});
