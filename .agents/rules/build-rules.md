# Antigravity Build & Command Execution Rules
- When running `npm run build` in Antigravity, always request sandbox bypass (`BypassSandbox: true`) because Next.js build-time module evaluation connects to MongoDB and requires network access.
- For type checks alone, prefer `npx tsc --noEmit` inside the sandbox.