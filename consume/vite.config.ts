import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  build: { target: "chrome95", sourcemap: true },
  plugins: [solid(), tailwindcss()],
});
