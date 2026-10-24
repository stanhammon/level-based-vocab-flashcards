import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the home-screen icons in public/ from public/favicon.svg:
//   npx pwa-assets-generator
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background: '#16213A' } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: '#16213A' } },
  },
  images: ['public/favicon.svg'],
})
