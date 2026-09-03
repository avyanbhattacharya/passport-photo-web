const { defineConfig, devices } = require('@playwright/test');

const crossBrowserSmoke = /.*(all-tools-regression|homepage|seo)\.spec\.js/;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', testMatch: crossBrowserSmoke, use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-webkit', testMatch: crossBrowserSmoke, use: { ...devices['iPhone 13'] } }
  ],
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
