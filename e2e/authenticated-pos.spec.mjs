import { expect, test } from '@playwright/test'

const email = process.env.E2E_CASHIER_EMAIL
const password = process.env.E2E_CASHIER_PASSWORD

async function login(page) {
  test.skip(!email || !password, 'Authenticated E2E credentials are not configured')
  await page.goto('./')
  await page.getByLabel('البريد الإلكتروني').fill(email)
  await page.getByLabel('كلمة المرور').fill(password)
  await page.getByRole('button', { name: 'دخول' }).click()
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15000 })
}

test.describe('authenticated cashier harness', () => {
  test('real session can open permission-scoped POS workspace', async ({ page }) => {
    await login(page)
    await page.goto('./#pos-section')
    await expect(page.getByRole('heading', { name: 'شاشة البيع' })).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.pos-operational-panel')).toBeVisible()
    await expect(page.getByText('طلبات/طاولات', { exact: false })).toBeVisible()
  })
})
