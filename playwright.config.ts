import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({ testDir: './e2e', webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: true }, use: { baseURL: 'http://127.0.0.1:5173', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] } }, workers: 1, reporter: 'list' });
