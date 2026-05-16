# Project Instructions (Switchplay App)

## Project Context:
- Next.js App Router
- Main entry page: src/app/page.tsx
- Mock data: src/mocks/switchplayMockData.ts
- Mobile-first
- Prefer web architectures and interaction patterns that can later be adapted to React Native
- Use Motion for React from the beginning as the foundational layout and interaction animation system.

Start with:
- shared layout transitions
- spring-based positioning
- AnimatePresence
- layout animations

Delay:
- advanced gesture orchestration
- complex drag physics
- momentum systems
until the structural layout is stable.

## General Principles
- Write clean, production-ready React/Next.js code
- Avoid boilerplate or example/demo code
- Prefer functional components with hooks
- Use TypeScript for all files
- Keep components small and reusable
- Use functional programming styles with no side-effects or mutation of variables at any time

## Architecture Rules
- Separate UI components from page components
- Keep pages minimal and composed of components
- No business logic in UI components

## Styling
- use a mobile-first styling approach
- Prefer modern CSS or Tailwind (if used in project)
- Avoid inline styles unless necessary

## State Management
- Use simple local state unless global state is required
- Prefer local state with useState.
- Use Context only for genuinely shared cross-tree state.
- Avoid unnecessary global state.
- Do not introduce Redux unless explicitly requested

## API Rules
- Use a single API service layer when needed
- No direct fetch calls inside UI components

## Output Quality
- No placeholder code
- No “example” or “demo” components
- Code should be production-ready by default

## Design Rules
 - Use a mobile-first approach to layout decision