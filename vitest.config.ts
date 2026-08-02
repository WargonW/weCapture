import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest 测试配置：独立于 vite.config.ts，避免 Vite 版本类型冲突
export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    css: true,
  },
})
