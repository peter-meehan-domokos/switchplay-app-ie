This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Test baseline

Run these independently from the project root:

```bash
npm run test:e2e   # Playwright: tests/**/*.spec.ts and .spec.tsx only
npm run test:unit  # node:test via tsx: tests/*.test.ts only
npm run typecheck # Clean generated route types, next typegen, then tsc --noEmit
npm run build     # Production build
git diff --check
```

The current Playwright suite tests helpers and rendered components without starting
a browser or application server. The node:test suite requires no live database or
Cloudflare assets. Keep node:test files directly in `tests/` so the explicit command
includes them; fixtures can live in subdirectories.

Run `typecheck` with the development server stopped: it removes only generated
`.next/types` and `.next/dev/types`, then regenerates route definitions with the
installed Next CLI. It does not exclude generated types from TypeScript checking.

Characterisation tests describe legacy behaviour before the first-class Card
refactor. Intentional changes in later phases should update those expectations.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
