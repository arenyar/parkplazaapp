import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5174,
  },
  // `vite preview` — asıl production build'i (dist/) HTTP üzerinden sunar,
  // Netlify'a yüklenen halin yerelde en yakın karşılığı (dev server'daki
  // gibi HMR/kaynak dönüşümü yok, gerçek build çıktısı test edilir).
  preview: {
    port: Number(process.env.PORT) || 4173,
  },
});
