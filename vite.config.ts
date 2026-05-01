import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const dcvSdkPath = path.resolve(
  __dirname,
  "node_modules/bedrock-agentcore/dist/src/tools/browser/live-view/nice-dcv-web-client-sdk"
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      dcv: path.join(dcvSdkPath, "dcvjs-esm/dcv.js"),
      "dcv-ui": path.join(dcvSdkPath, "dcv-ui/dcv-ui.js"),
    },
  },
  server: {
    port: 5173,
    watch: {
      ignored: ["**/agent/**", "**/server/**"],
    },
  },
});
