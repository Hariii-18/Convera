# Converra

Frontend foundation for the Converra SaaS application.

## Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript (strict)
- Tailwind CSS v4
- shadcn/ui + Lucide React
- TanStack Query
- Zustand
- React Hook Form + Zod
- Framer Motion
- next-themes

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                 | Description                     |
| ---------------------- | -------------------------------- |
| `npm run dev`           | Start the dev server (Turbopack) |
| `npm run build`         | Production build                 |
| `npm run start`         | Serve the production build       |
| `npm run lint`          | Lint with ESLint                 |
| `npm run format`        | Format with Prettier             |
| `npm run format:check`  | Check formatting                 |

## Project structure

```
src/
  app/          # Routes, layout, providers, metadata
  components/
    ui/         # shadcn/ui primitives
    layout/     # Header, Footer, app shell
    dashboard/  # Dashboard-scoped components (empty scaffold)
    shared/     # Reusable presentational components
  features/     # Feature modules (empty scaffold)
  hooks/        # Reusable, domain-agnostic hooks
  lib/          # Fonts, query client, utils
  services/     # API/service layer (empty scaffold)
  store/        # Zustand stores
  types/        # Shared type helpers
  styles/       # Global CSS
  assets/       # Static assets bundled through the app
```
