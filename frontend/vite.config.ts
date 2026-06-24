import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true, passes: 2 },
      mangle: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('react-router-dom')) return 'vendor';
          if (id.includes('lucide-react')) return 'lucide';
          if (id.includes('@twa-dev')) return 'twa';
        },
      },
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false,
  },
})
