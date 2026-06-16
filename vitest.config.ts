import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// เทสเฉพาะ logic ฝั่ง pure (ไม่แตะ DB/RSC) — ดู tests/
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // โมดูลที่ import "server-only" ให้ชี้ไป stub ว่าง เพื่อให้เทสนอก Next ได้
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
