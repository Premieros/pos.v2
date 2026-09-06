# Database Identity Lock — POS.V2

This rule is mandatory for every developer, automation, AI agent, CI workflow, migration, seed, test, local environment and deployment connected to this repository.

## Canonical database identity

This repository is bound to exactly one Supabase project:

- Repository: `Premieros/pos.v2`
- Supabase project name: `pos.v2`
- Supabase project ref: `scpovyrqmsbiduanykod`
- Supabase project URL: `https://scpovyrqmsbiduanykod.supabase.co`

This identity is part of the system contract.

## Non-negotiable isolation rule

POS.V2 must never share, reuse, mix, import from, migrate into, or temporarily point at a database belonging to another project or repository.

The following are forbidden:

1. Running POS.V2 migrations against any Supabase project whose ref is not `scpovyrqmsbiduanykod`.
2. Pointing POS.V2 runtime environment variables to another Supabase project, even temporarily for debugging.
3. Reusing database URLs, connection strings, secrets, service keys, migration history, seeds, dumps or schema state from another project.
4. Copying legacy project migrations as implementation history for POS.V2.
5. Running reset, seed, repair, migration, schema push, SQL DDL or destructive scripts against another project's database from this repository.
6. Mixing production, development or test data from another repository into this database without an explicit, reviewed data-import plan.
7. Treating another Supabase project as an interchangeable development or staging database for POS.V2.

## Mandatory preflight check

Before every schema-changing or data-destructive database operation, verify the target Supabase project ref.

Expected value:

`scpovyrqmsbiduanykod`

If the detected ref does not match exactly, STOP immediately. Do not migrate, seed, reset, repair, push, delete, truncate or modify the target database.

## Environment rule

Only the public project URL and publishable client key may be used in frontend runtime configuration.

Database passwords, secret keys and service-role credentials must never be committed to GitHub or embedded in frontend code.

## Project separation rule

Any other Supabase project is considered a separate system with separate migration history, separate secrets, separate data and separate operational ownership.

A change to the canonical database identity requires an explicit owner decision and a dedicated migration/transition plan. It must never happen as a side effect of a bug fix, local test, deployment change or developer convenience.

## Change Isolation interaction

A fix in one module must never change the database identity, connection target or migration destination of another environment. Database connection changes are infrastructure changes and must be reviewed separately from feature or bug-fix work.
