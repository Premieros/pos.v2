# POS.V2 — Persistent Demo Data Log

Date: 2026-09-06 (Africa/Cairo)  
Repository: `Premieros/pos.v2`  
Branch: `development`  
Locked Supabase project: `scpovyrqmsbiduanykod`  
Demo branch code: `DEMO`

## Retention rule
The user explicitly requested a complete demo dataset for full-system testing and explicitly requested that it **must not be deleted after testing**.

All seeded entities are isolated under the dedicated branch `DEMO` and use `DEMO`-prefixed codes, notes, references, or idempotency keys where the schema allows it. The existing `MAIN` branch was not used as the demo-data container.

## Seeded coverage
- 1 dedicated demo branch.
- 2 warehouses.
- 4 product categories.
- 8 inventory items.
- 7 sellable products, including direct-stock products and BOM/component products.
- 2 suppliers.
- 4 dining tables across two floor names.
- 2 shifts: one historical closed shift and one current open shift.
- 6 POS orders covering `created`, `held`, `preparing`, `ready`, `paid`, and `returned` states and multiple order types.
- 14 order lines.
- 4 Kitchen/KDS tickets with `preparing`, `ready`, and completed historical examples.
- 3 payments covering Cash, Card, split tender, and refunded payment status.
- Payment allocations for historical orders.
- 1 return and 1 refund with stock-restock lineage.
- Opening stock for every demo inventory item.
- 2 purchase orders: one fully received and one submitted/pending receipt.
- 1 purchase receipt with exact stock-movement lineage and historical unit costs.
- 1 posted waste document with exact stock movement.
- 1 posted stock count with variance movement plus an approved approval request.
- 7 accounting accounts covering asset, liability, equity, revenue, and expense types.
- 3 posted balanced journal entries; each verified debit = credit.
- 1 posted expense linked to its journal entry.
- 2 treasury accounts (cash + bank) and 1 treasury movement linked to a balanced journal entry.

## Verification snapshot
Verified after seed:
- warehouses: 2
- categories: 4
- inventory items: 8
- products: 7
- suppliers: 2
- dining tables: 4
- shifts: 2
- orders: 6
- order items: 14
- kitchen tickets: 4
- payments: 3
- returns/refunds: 1 / 1
- purchase orders/receipts: 2 / 1
- waste documents: 1
- stock counts/approvals: 1 / 1
- accounts/journals: 7 / 3
- expenses: 1
- treasury accounts/movements: 2 / 1

Journal verification:
- Entry 3001: debit 5000 = credit 5000.
- Entry 3002: debit 350 = credit 350.
- Entry 3003: debit 500 = credit 500.

Inventory verification confirms positive demo balances after receipt, waste, and count adjustment movements.

## Design checkpoint
The final UI polish was updated in `src/styles/final-ui.css` to tighten the production visual system: stronger glass hierarchy, sticky desktop workspace header, clearer tables and totals, improved product cards/POS selection states, focus/touch states, and responsive preservation without moving authorization or business logic into layout code.

## Safety / scope
- No `main` merge was performed.
- No demo cleanup is authorized by this log.
- Database identity remains locked to `scpovyrqmsbiduanykod`.
- Any future cleanup of DEMO data requires a new explicit user instruction.
