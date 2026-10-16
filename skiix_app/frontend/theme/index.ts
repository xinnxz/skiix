export const Colors = {
  // Core palette
  primary: "#70DAFF",
  primaryMuted: "rgba(112, 218, 255, 0.15)",
  primaryBorder: "rgba(112, 218, 255, 0.2)",
  primaryGlow: "rgba(112, 218, 255, 0.08)",

  // Backgrounds
  bgBlack: "#000000",
  surface: "#0A0A0A",
  surface2: "#111111",
  surface3: "#1A1A1A",
  surface4: "#222222",

  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textMuted: "#52525B",
  textDisabled: "#3F3F46",

  // Borders
  border: "rgba(255, 255, 255, 0.08)",
  borderAccent: "rgba(112, 218, 255, 0.2)",

  // Status
  destructive: "#FF4D6A",
  destructiveMuted: "rgba(255, 77, 106, 0.15)",
  success: "#4DFFA0",
  successMuted: "rgba(77, 255, 160, 0.15)",
  warning: "#FFD166",
  warningMuted: "rgba(255, 209, 102, 0.15)",

  // Roles
  investor: "#FFD700",
  investorMuted: "rgba(255, 215, 0, 0.15)",
  founder: "#70DAFF",
  founderMuted: "rgba(112, 218, 255, 0.15)",

  // Overlays
  overlay: "rgba(0, 0, 0, 0.6)",
  overlayHeavy: "rgba(0, 0, 0, 0.85)",
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  full: 9999,
} as const;

export const Typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  "2xl": 28,
  "3xl": 32,
  "4xl": 40,

  // Font weights (for reference)
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,

  // Line heights
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const Shadows = {
  primaryGlow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

/** Gradient configs used across the app */
export const Gradients = {
  primaryFade: ["rgba(112, 218, 255, 0.3)", "transparent"] as const,
  darkOverlay: ["transparent", "rgba(0,0,0,0.9)"] as const,
  surfaceGradient: ["#0A0A0A", "#000000"] as const,
  investorGold: ["#FFD700", "#FFA500"] as const,
  profileHeader: ["transparent", "rgba(0,0,0,0.95)"] as const,
};
