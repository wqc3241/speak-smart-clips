import '@testing-library/jest-dom';

// Stub import.meta.env for tests
if (!(globalThis as Record<string, unknown>).__vitest_environment__) {
  // Already in vitest, env is available
}

// Provide default env stubs
Object.assign(import.meta.env, {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  VITE_DEV_TEST_MODE: '',
  VITE_TEST_EMAIL: '',
  VITE_TEST_PASSWORD: '',
});
