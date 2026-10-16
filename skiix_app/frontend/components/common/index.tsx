import React, { forwardRef, useEffect } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  TextInput,
  TextInputProps,
  ActivityIndicator,
  Image,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, BorderRadius, Typography } from "@/theme";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// ─── BUTTON ─────────────────────────────────────────────────

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
}: ButtonProps) {
  const heights = { sm: 36, md: 44, lg: 52 };
  const fontSizes = {
    sm: Typography.sm,
    md: Typography.base,
    lg: Typography.md,
  };
  const paddings = { sm: 12, md: 16, lg: 20 };

  const containerStyle: ViewStyle = {
    height: heights[size],
    paddingHorizontal: paddings[size],
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    opacity: disabled || loading ? 0.5 : 1,
    ...(variant === "primary" && { backgroundColor: Colors.primary }),
    ...(variant === "secondary" && {
      borderWidth: 1,
      borderColor: Colors.primary,
      backgroundColor: Colors.primaryMuted,
    }),
    ...(variant === "ghost" && { backgroundColor: "transparent" }),
    ...(variant === "destructive" && {
      backgroundColor: Colors.destructiveMuted,
      borderWidth: 1,
      borderColor: Colors.destructive,
    }),
  };

  const textColor =
    variant === "primary"
      ? Colors.bgBlack
      : variant === "destructive"
        ? Colors.destructive
        : Colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[containerStyle, style]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={fontSizes[size] + 2}
              color={textColor}
            />
          )}
          <Text
            style={{
              fontSize: fontSizes[size],
              fontWeight: "600",
              color: textColor,
              letterSpacing: 0.2,
            }}
          >
            {label}
          </Text>
          {rightIcon && (
            <Ionicons
              name={rightIcon}
              size={fontSizes[size] + 2}
              color={textColor}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── TEXT INPUT ──────────────────────────────────────────────

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightElement?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    { label, error, leftIcon, rightElement, containerStyle, style, ...props },
    ref,
  ) => {
    const [focused, setFocused] = React.useState(false);

    return (
      <View style={containerStyle}>
        {label && (
          <Text
            style={{
              color: Colors.textSecondary,
              fontSize: Typography.sm,
              fontWeight: "500",
              marginBottom: 6,
              letterSpacing: 0.3,
            }}
          >
            {label}
          </Text>
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: Colors.surface2,
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            borderColor: error
              ? Colors.destructive
              : focused
                ? Colors.primary
                : Colors.borderAccent,
            paddingHorizontal: 14,
            height: 48,
          }}
        >
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={18}
              color={focused ? Colors.primary : Colors.textMuted}
              style={{ marginRight: 8 }}
            />
          )}
          <TextInput
            ref={ref}
            {...props}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            style={[
              {
                flex: 1,
                color: Colors.textPrimary,
                fontSize: Typography.base,
              },
              style,
            ]}
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
          />
          {rightElement}
        </View>
        {error && (
          <Text
            style={{
              color: Colors.destructive,
              fontSize: Typography.xs,
              marginTop: 4,
            }}
          >
            {error}
          </Text>
        )}
      </View>
    );
  },
);
Input.displayName = "Input";

// ─── AVATAR ──────────────────────────────────────────────────

interface AvatarProps {
  uri?: string | null;
  displayName?: string;
  size?: number;
  style?: ViewStyle;
  showBorder?: boolean;
}

export function Avatar({
  uri,
  displayName,
  size = 40,
  style,
  showBorder = false,
}: AvatarProps) {
  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: Colors.surface3,
          alignItems: "center",
          justifyContent: "center",
          ...(showBorder && {
            borderWidth: 2,
            borderColor: Colors.primary,
          }),
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text
          style={{
            color: Colors.primary,
            fontSize: size * 0.35,
            fontWeight: "700",
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

// ─── BADGE ───────────────────────────────────────────────────

interface BadgeProps {
  label: string;
  variant?:
    | "primary"
    | "investor"
    | "founder"
    | "success"
    | "warning"
    | "muted";
  size?: "sm" | "md";
  icon?: keyof typeof Ionicons.glyphMap;
}

export function Badge({
  label,
  variant = "primary",
  size = "sm",
  icon,
}: BadgeProps) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    primary: {
      bg: Colors.primaryMuted,
      text: Colors.primary,
      border: Colors.primaryBorder,
    },
    investor: {
      bg: Colors.investorMuted,
      text: Colors.investor,
      border: "rgba(255,215,0,0.3)",
    },
    founder: {
      bg: Colors.founderMuted,
      text: Colors.founder,
      border: Colors.primaryBorder,
    },
    success: {
      bg: Colors.successMuted,
      text: Colors.success,
      border: "rgba(77,255,160,0.3)",
    },
    warning: {
      bg: Colors.warningMuted,
      text: Colors.warning,
      border: "rgba(255,209,102,0.3)",
    },
    muted: {
      bg: Colors.surface3,
      text: Colors.textSecondary,
      border: Colors.border,
    },
  };

  const c = colors[variant];
  const fs = size === "sm" ? Typography.xs : Typography.sm;
  const px = size === "sm" ? 8 : 12;
  const py = size === "sm" ? 3 : 5;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: c.bg,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        borderColor: c.border,
        paddingHorizontal: px,
        paddingVertical: py,
        alignSelf: "flex-start",
      }}
    >
      {icon && <Ionicons name={icon} size={fs + 1} color={c.text} />}
      <Text style={{ color: c.text, fontSize: fs, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

// ─── CARD ────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  glow?: boolean;
}

export function Card({ children, style, onPress, glow = false }: CardProps) {
  const baseStyle: ViewStyle = {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius["2xl"],
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    padding: 16,
    ...(glow && {
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    }),
  };

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[baseStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
}

// ─── SKELETON ────────────────────────────────────────────────

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: Colors.surface3,
        },
        style,
      ]}
    />
  );
}

// ─── DIVIDER ─────────────────────────────────────────────────

export function Divider({ style }: { style?: ViewStyle }) {
  return (
    <View
      style={[
        { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
        style,
      ]}
    />
  );
}

// ─── PILL / CHIP ─────────────────────────────────────────────

interface PillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function Pill({ label, active, onPress }: PillProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        borderColor: active ? Colors.primary : Colors.border,
        backgroundColor: active ? Colors.primaryMuted : "transparent",
      }}
    >
      <Text
        style={{
          color: active ? Colors.primary : Colors.textSecondary,
          fontSize: Typography.sm,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
