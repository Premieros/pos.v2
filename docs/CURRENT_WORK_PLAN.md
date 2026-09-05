# Current Work Plan — POS.V2

## Current phase: Foundation

### Completed
- New empty GitHub repository verified.
- New Supabase project verified healthy and public schema verified empty before initialization.
- Clean-room architecture adopted.
- Development rules and system contract established.
- Core identity/branch/permission migration created and applied.
- Minimal React + TypeScript + Vite application scaffold created.

### Next gates
1. Verify database migration and Supabase security/performance advisors.
2. Add generated database types and environment-safe Supabase client integration.
3. Implement Auth bootstrap and Super Admin bootstrap path.
4. Implement branch context and effective permission resolver.
5. Add automated tests/CI before Catalog or POS work.

## Build order
Foundation -> Auth -> Branches/Permissions -> Catalog -> Inventory -> Shifts -> POS -> Kitchen -> Payments -> Operations -> Accounting -> Reports -> Printing/Offline -> Full E2E.

## Production rule
No merge from `development` to `main` until the current phase passes its verification gate.
