import React from "react";
import { View, Dimensions } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";

const { width, height } = Dimensions.get("window");

export function RadialGlowBackground() {
  return (
    <View className="absolute inset-0">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient
            id="bgGlow"
            cx="50%"
            cy="25%"
            rx="50%"
            ry="40%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="10%" stopColor="#0e4452" stopOpacity="0.8" />
            <Stop offset="70%" stopColor="#07151d" stopOpacity="1" />
            <Stop offset="90%" stopColor="#080c10" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#bgGlow)" />
      </Svg>
    </View>
  );
}
