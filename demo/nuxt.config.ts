import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/main.css', 'maplibre-gl/dist/maplibre-gl.css'],
  vite: { plugins: [tailwindcss()], optimizeDeps: { include: ['lucide-vue-next', 'motion-v'], exclude: ['maplibre-gl'] } },
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      htmlAttrs: { lang: 'fr' },
      title: "Facili'TBM — mon trajet",
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#002862' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: 'icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Lexend:wght@500;600;700&display=swap' },
      ],
    },
  },
})
