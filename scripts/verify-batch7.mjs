import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`)
  return readFileSync(path, 'utf8')
}

function requireText(path, snippets) {
  const text = read(path)
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${path} is missing Batch 7 contract marker: ${snippet}`)
  }
}

const migrations = [
  ['supabase/migrations/20260905183814_chart_of_accounts_foundation.sql', ['accounting.coa.view', 'accounting.coa.manage', 'create_account']],
  ['supabase/migrations/20260905184225_journal_entries_and_balanced_lines.sql', ['accounting.journals.view', 'accounting.journals.post', 'journal_entries', 'journal_lines']],
  ['supabase/migrations/20260905184632_expenses_and_source_linked_posting.sql', ['accounting.expenses.view', 'expense_documents', 'post_expense_document_internal', "'expense',v_expense.id"]],
  ['supabase/migrations/20260905185108_treasury_accounts_and_movements.sql', ['treasury.view', 'treasury_accounts', 'treasury_movements']],
  ['supabase/migrations/20260905185128_treasury_movement_concurrency_hardening.sql', ['for update', 'treasury']],
  ['supabase/migrations/20260905185715_automatic_operational_accounting_source_links.sql', ['accounting.posting.view', 'accounting_posting_mappings', 'accounting_source_postings']],
  ['supabase/migrations/20260905185732_purchase_accounting_deferred_line_posting.sql', ['purchase_receipt_lines']],
  ['supabase/migrations/20260905190306_accounting_source_posting_error_and_return_hardening.sql', ['returned', 'error']],
  ['supabase/migrations/20260905190820_journal_reversal_and_refund_posting.sql', ['accounting.journals.reverse', 'journal_reversals', 'reverse_journal_entry', "source_type='refund'"]],
  ['supabase/migrations/20260905191302_accounting_statements_contracts.sql', ['accounting.statements.view', 'get_trial_balance', 'get_general_ledger', 'get_income_statement', 'get_balance_sheet']],
  ['supabase/migrations/20260905191630_statement_account_reference_api.sql', ['get_statement_accounts']],
]

for (const [path, snippets] of migrations) requireText(path, snippets)
requireText('docs/DATABASE_IDENTITY_LOCK.md', ['scpovyrqmsbiduanykod'])
requireText('.github/workflows/verify.yml', ['https://scpovyrqmsbiduanykod.supabase.co'])

requireText('src/modules/accounting/ChartOfAccountsPage.tsx', ["can('accounting.coa.manage')"])
requireText('src/modules/accounting/JournalPage.tsx', ["can('accounting.journals.reverse')", 'reverseJournalEntry'])
requireText('src/modules/accounting/ExpensesPage.tsx', ['accounting.expenses'])
requireText('src/modules/accounting/TreasuryPage.tsx', ['treasury.'])
requireText('src/modules/accounting/PostingCenterPage.tsx', ['accounting.posting.'])
requireText('src/modules/accounting/StatementsPage.tsx', ["can('accounting.statements.view')", 'getTrialBalance', 'getGeneralLedger', 'getIncomeStatement', 'getBalanceSheet'])
requireText('src/app/App.tsx', ["can('accounting.journals.reverse')", "can('accounting.statements.view')", "can('accounting.posting.view')"])

const guardedSources = [
  'src/modules/accounting/account.service.ts',
  'src/modules/accounting/journal.service.ts',
  'src/modules/accounting/expense.service.ts',
  'src/modules/accounting/treasury.service.ts',
  'src/modules/accounting/posting.service.ts',
  'src/modules/accounting/statements.service.ts',
  'src/modules/accounting/ChartOfAccountsPage.tsx',
  'src/modules/accounting/JournalPage.tsx',
  'src/modules/accounting/ExpensesPage.tsx',
  'src/modules/accounting/TreasuryPage.tsx',
  'src/modules/accounting/PostingCenterPage.tsx',
  'src/modules/accounting/StatementsPage.tsx',
].map(read).join('\n')

if (/role\s*===|role_name\s*===|\.role\s*===/.test(guardedSources)) {
  throw new Error('Role-label authorization detected in Batch 7 feature code')
}

for (const marker of [
  ".from('journal_entries').insert",
  ".from('journal_lines').insert",
  ".from('expense_documents').insert",
  ".from('treasury_accounts').insert",
  ".from('treasury_movements').insert",
  ".from('accounting_posting_mappings').insert",
  ".from('accounting_source_postings').insert",
  ".from('journal_reversals').insert",
]) {
  if (guardedSources.includes(marker)) throw new Error(`Direct sensitive accounting table write reintroduced: ${marker}`)
}

if (!read('supabase/migrations/20260905184225_journal_entries_and_balanced_lines.sql').includes("status='posted'")) {
  throw new Error('Posted-journal contract marker missing')
}

console.log('Batch 7 repository contract regression guard: PASS')
