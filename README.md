# POS.V2

Clean-room rebuild of a restaurant POS/ERP platform.

## Architecture

- React + TypeScript + Vite
- Supabase PostgreSQL/Auth
- Permission-first authorization
- Branch-scoped access enforced by RLS
- Modular domain architecture
- Contract-first backend/frontend integration
- Arabic RTL first, English LTR secondary

## Development rule

The legacy project is a requirements reference only. No legacy code is copied into this repository by default.

All feature work happens on `development` (or short-lived branches from it) and is merged to `main` only after verification.
