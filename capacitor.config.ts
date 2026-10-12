import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ramanujanacademy.connect",
  appName: "Ramanujan Academy",
  webDir: "dist",
  bundledWebRuntime: false,
  backgroundColor: "#fffdf5",
  android: {
    allowMixedContent: false,
  },
};

export default config;
