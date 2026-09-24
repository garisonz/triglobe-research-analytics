import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:5174", trace: "retain-on-failure" },
  webServer: [
    {
      command:
        "cd ../api && .venv/bin/python -m uvicorn tests.auth_server:app --host 127.0.0.1 --port 8001",
      url: "http://127.0.0.1:8001/health",
      reuseExistingServer: false,
    },
    {
      command:
        "API_PROXY_TARGET=http://127.0.0.1:8001 npm run dev -- --host localhost --port 5174",
      url: "http://localhost:5174",
      reuseExistingServer: false,
    },
  ],
})
