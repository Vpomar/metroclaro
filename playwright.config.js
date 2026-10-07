// Pruebas end-to-end: levantan la app con el servidor local apuntando a
// STAGING (nunca a producción) y la recorren en Chromium.
import { defineConfig, devices } from '@playwright/test';

const STAGING_URL = 'https://tverjzxsmwnrnpnsimgh.supabase.co';
const STAGING_KEY = 'sb_publishable_jaulU_4O4K9LPVdthkQI_Q_WCFb6voK';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8000',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/servidor-local.mjs',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL || STAGING_URL,
      SUPABASE_KEY: process.env.SUPABASE_KEY || STAGING_KEY,
      PUERTO: '8000'
    }
  }
});
