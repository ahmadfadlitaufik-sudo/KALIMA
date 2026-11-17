import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      proxy: { '/api': 'http://localhost:8787' },
    },
    preview: {
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0',
    },
    build: {
      target: 'es2022',
      minify: true,
      cssMinify: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          // Modular vendor chunking to maximize browser HTTP/2 caching and fast parallel loading
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // Priority 1: Icons & visual helpers
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              // Priority 2: Animation library
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              // Priority 3: Large chart & visualization packages
              if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
                return 'vendor-charts';
              }
              // Priority 4: React Core
              if (
                id.includes('/react/') ||
                id.includes('/react-dom/') ||
                id.includes('scheduler')
              ) {
                return 'vendor-react';
              }
              return 'vendor-others';
            }
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  };
});
