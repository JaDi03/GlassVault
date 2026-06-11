# Contributing to GlassVault

Thank you for your interest in contributing. This guide covers the basics of working with this repository.

## Getting Started

```bash
git clone https://github.com/JaDi03/glassvault.git
cd glassvault
npm install
cp .env.example .env
```

## Branch Strategy

- `main` - Production-ready code only
- `dev` - Integration branch (target for all PRs)
- `feature/*` - Feature development (e.g. `feature/venice-integration`)

**Never commit directly to `main` or `dev`.**

## Development Workflow

1. Branch from `dev`: `git checkout -b feature/your-feature dev`
2. Make incremental commits with conventional messages:
   - `feat: add wallet connection hook`
   - `fix: resolve SSE reconnection bug`
   - `refactor: extract chain config to shared package`
3. Open a PR against `dev` with a clear description.
4. CI must pass before merge.

## Code Standards

- All code, variable names, comments, and documentation must be in **English**.
- TypeScript strict mode is enforced - no `any` types without justification.
- ESLint must pass with zero warnings (`npm run lint`).
- No em dashes (`-`) in any file - use colons or regular hyphens.

## Running Tests

```bash
npm run test
```

## Commit Message Format

```
type(scope): short description

body (optional)
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
