import { defineConfig } from "@hey-api/openapi-ts"

// Regenerates src/client from the running API: `npm run generate-client`.
export default defineConfig({
  input: "http://localhost:8000/openapi.json",
  output: "src/client",
  plugins: ["@hey-api/client-fetch", "@tanstack/react-query"],
})
