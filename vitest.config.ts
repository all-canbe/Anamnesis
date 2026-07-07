import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    env: {
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD_HASH: "$2b$10$1Dzx81OnbD75Dhl7/fLdhemfu9dTEcinU0g95c6blJrrLNiYK.xzm",
      JWT_SECRET: "test-secret-key-at-least-32-chars-long!!",
      NODE_ENV: "test",
    },
  },
});