import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Only include tests from the tests/unit directory
    include: ['tests/unit/**/*.test.{ts,tsx,js,jsx}'],

    // Explicitly exclude Supabase function tests (they're for Deno)
    exclude: [
      'node_modules/**',
      'supabase/**',
      'dist/**',
      '.idea/**',
      '.git/**',
      '*.config.{js,ts}',
    ],

    // Use jsdom for any potential future React component tests
    environment: 'node',

    // Setup globals if needed
    globals: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});