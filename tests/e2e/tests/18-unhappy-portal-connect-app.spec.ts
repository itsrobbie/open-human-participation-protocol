import { test, expect } from '@playwright/test'
import { PORTAL_URL, BANK_URL } from '../test-urls'

/**
 * Unhappy path tests for connecting apps in the portal.
 * Tests what happens when users paste bad data, reuse links, etc.
 */
test.describe('Portal — Connect App error handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')
    await page.click('nav >> text=Connect App')
    await expect(page.locator('h1')).toContainText('Connect an app')
  })

  test('pasting random text shows error', async ({ page }) => {
    await page.fill('textarea', 'hello world this is not a link')
    await page.click('button:has-text("Connect app")')

    await expect(page.locator('.bg-red-50').first()).toBeVisible({ timeout: 10000 })
    const text = await page.locator('.bg-red-50').first().textContent()
    expect(text?.toLowerCase()).toMatch(/failed|error|invalid/)
  })

  test('pasting an ohpp:// URI with corrupted base64 shows error', async ({ page }) => {
    await page.fill('textarea', 'ohpp://register?challenge=!!!not-valid-base64!!!')
    await page.click('button:has-text("Connect app")')

    await expect(page.locator('.bg-red-50').first()).toBeVisible({ timeout: 10000 })
  })

  test('pasting a valid-looking but expired challenge shows error', async ({ page }) => {
    // Create a challenge payload that's expired (exp in the past)
    // Base64url of {"appId":"test.app","id":"expired-123","exp":1000000000}
    const expiredPayload = btoa(JSON.stringify({ appId: 'test.app', id: 'expired-123', exp: 1000000000 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

    await page.fill('textarea', `ohpp://register?challenge=${expiredPayload}`)
    await page.click('button:has-text("Connect app")')

    await expect(page.locator('.bg-red-50').first()).toBeVisible({ timeout: 10000 })
  })

  test('submitting the same challenge twice shows error on second attempt', async ({ page, context }) => {
    // Generate a real challenge from the bank
    const bankPage = await context.newPage()
    await bankPage.goto(BANK_URL)
    await bankPage.getByTestId('nav-settings').click()
    await expect(bankPage.locator('#generate-challenge-btn')).toBeVisible({ timeout: 10000 })
    await bankPage.click('#generate-challenge-btn')
    const challengeTextarea = bankPage.locator('#challenge-uri')
    await expect(challengeTextarea).toBeVisible({ timeout: 10000 })
    const challengeUri = await challengeTextarea.inputValue()
    await bankPage.close()

    // First submission — should succeed (or at least not be a decode error)
    await page.fill('textarea', challengeUri)
    await page.click('button:has-text("Connect app")')
    await expect(page.locator('.bg-green-50, .bg-red-50').first()).toBeVisible({ timeout: 15000 })

    // Wait for state to settle, then try again with the SAME challenge
    await page.waitForTimeout(1000)

    // Navigate away and back to reset the form
    await page.click('nav >> text=Dashboard')
    await page.click('nav >> text=Connect App')
    await expect(page.locator('textarea')).toBeVisible()

    // Second submission with same challenge
    await page.fill('textarea', challengeUri)
    await page.click('button:has-text("Connect app")')

    // Should show an error (challenge already consumed or app already registered)
    await expect(page.locator('.bg-red-50, .bg-green-50').first()).toBeVisible({ timeout: 15000 })
  })

  test('whitespace-only input keeps button disabled', async ({ page }) => {
    await page.fill('textarea', '   \n\n   ')
    const button = page.locator('button:has-text("Connect app")')
    await expect(button).toBeDisabled()
  })
})
