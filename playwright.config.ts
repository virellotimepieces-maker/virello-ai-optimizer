import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:43217",
    trace: "off",
  },
  webServer: {
    command: "npx next dev --port 43217",
    url: "http://127.0.0.1:43217",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      APP_URL: "http://127.0.0.1:43217",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
