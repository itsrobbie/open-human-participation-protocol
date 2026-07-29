import { test, expect } from '@playwright/test'
import { PORTAL_URL } from '../test-urls'

test.describe('Portal — Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')
  })

  test('all navigation links are visible', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.locator('nav >> text=Dashboard')).toBeVisible()
    await expect(page.locator('nav >> text=Pending')).toBeVisible()
    await expect(page.locator('nav >> text=History')).toBeVisible()
    await expect(page.locator('nav >> text=Devices')).toBeVisible()
    await expect(page.locator('nav >> text=Apps')).toBeVisible()
    await expect(page.locator('nav >> text=Connect App')).toBeVisible()
  })

  test('navigate to Pending page', async ({ page }) => {
    await page.click('nav >> text=Pending')
    await expect(page.locator('h1')).toContainText('Pending Requests')
  })

  test('navigate to History page', async ({ page }) => {
    await page.click('nav >> text=History')
    await expect(page.locator('h1')).toContainText('Participation History')
  })

  test('navigate to Devices page', async ({ page }) => {
    await page.click('nav >> text=Devices')
    await expect(page.locator('h1')).toContainText('Devices')
  })

  test('navigate to Apps page', async ({ page }) => {
    await page.click('nav >> text=Apps')
    await expect(page.locator('h1')).toContainText('Registered Apps')
  })

  test('navigate to Connect App page', async ({ page }) => {
    await page.click('nav >> text=Connect App')
    await expect(page.locator('h1')).toContainText('Connect an app')
  })

  test('navigate to Settings page via direct URL', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/settings`)
    await expect(page.locator('h1')).toContainText('Developer Settings')
  })

  test('sign out button visible in nav', async ({ page }) => {
    await expect(page.locator('text=Sign out')).toBeVisible()
  })
})
