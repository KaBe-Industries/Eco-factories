/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the build works on GitHub Pages under any sub-path.
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
