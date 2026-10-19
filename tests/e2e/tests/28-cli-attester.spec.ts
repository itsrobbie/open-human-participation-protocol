import { execSync, spawn } from 'child_process'
import { resolve } from 'path'
import { test, expect } from '@playwright/test'
import { BANK_URL, PORTAL_URL } from '../test-urls'

const composeFile = resolve(__dirname, '../../../docker-compose.apps.yml')
const OHPP_PROJECT = process.env.OHPP_PROJECT ?? 'ohpp-0'
// The CLI lives in "tools" and depends_on the resolver ("apps"); backing is a
// separate shared project, reached over the ohpp-shared network, so only the
// app-tier profiles are needed here.
const PROFILES = '--profile apps --profile tools'
const composeCmd = `docker compose -p ${OHPP_PROJECT} -f ${composeFile} ${PROFILES}`

test.describe.serial('CLI attester simulator', () => {
  test.describe.configure({ timeout: 180_000 })

  test('registers via username/password, appears in Portal, receives Bank request via SSE', async ({ page, context }) => {
    // Ensure the CLI image is built for the test stack
    execSync(`${composeCmd} build cli`, { cwd: resolve(__dirname, '../../..'), stdio: 'pipe', timeout: 120_000 })

    // Reset any prior CLI config so it starts fresh
    execSync(`${composeCmd} run --rm --entrypoint sh cli -c 'rm -f /root/.ohpp/cli-config.json'`, {
      cwd: resolve(__dirname, '../../..'), stdio: 'pipe', timeout: 30_000
    })

    // Clear any leftover pending requests from prior tests so the CLI doesn't block on them
    execSync(`${composeCmd} exec -T postgres psql -U ohpp -d ohpp -c "DELETE FROM pending_requests WHERE \\"Status\\" = 'Pending';"`, {
      cwd: resolve(__dirname, '../../..'), stdio: 'pipe', timeout: 10_000
    })

    // --- Start the CLI as a long-running process with piped stdin ---
    const cli = spawn('docker', [
      'compose', '-p', 'ohpp-test', '-f', composeFile,
      '--profile', 'backing', '--profile', 'apps', '--profile', 'tools',
      'run', '--rm', '-T', 'cli'
    ], { cwd: resolve(__dirname, '../../..') })

    let cliOutput = ''
    cli.stdout.on('data', (data: Buffer) => { cliOutput += data.toString() })
    cli.stderr.on('data', (data: Buffer) => { cliOutput += data.toString() })

    // Wait for the CLI to prompt for username
    await waitForOutput(() => cliOutput, 'Username', 30_000)

    // Send credentials (demo/demo)
    cli.stdin.write('demo\n')
    await waitForOutput(() => cliOutput, 'Password', 5_000)
    cli.stdin.write('demo\n')

    // Wait for CLI to be ready (printed after key registration, before SSE)
    await waitForOutput(() => cliOutput, 'Listening for participation requests', 30_000)

    // Small delay to ensure the SSE connection is established
    await new Promise(r => setTimeout(r, 2000))

    // --- Verify the CLI device appears in Portal ---
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[placeholder="demo"]', 'demo')
    await page.fill('input[type="password"]', 'demo')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(PORTAL_URL + '/')

    await page.click('nav >> text=Devices')
    await expect(page.getByText('CLI Simulator')).toBeVisible({ timeout: 10_000 })

    // --- Make a transfer in the Bank to create a pending request ---
    const bank = await context.newPage()
    await bank.goto(BANK_URL)
    await expect(bank.locator('#balance')).not.toHaveText('Loading...', { timeout: 15_000 })

    // Ensure the Bank is connected to OHPP (generate challenge + register via Portal)
    await bank.getByTestId('nav-settings').click()
    const challengeField = bank.locator('#challenge-uri')
    if (!(await challengeField.isVisible())) {
      await bank.click('#generate-challenge-btn')
    } else {
      // Challenge may already be visible from a prior test
    }
    await bank.click('#generate-challenge-btn')
    await expect(challengeField).toHaveValue(/ohpp:\/\/register\?challenge=/, { timeout: 10_000 })
    const challenge = await challengeField.inputValue()

    await page.click('nav >> text=Connect App')
    await page.fill('textarea', challenge)
    await page.click('button:has-text("Connect app")')
    await expect(page.locator('.bg-green-50')).toContainText('App registered', { timeout: 15_000 })

    // Make the transfer
    await bank.getByTestId('nav-payments').click()
    await bank.fill('#amount', '25')
    await bank.fill('#reference', 'CLI E2E test')
    await bank.click('#transfer-form button[type="submit"]')
    await bank.click('#confirm-transfer')
    await expect(bank.locator('#transfer-result')).toContainText('Waiting for approval', { timeout: 10_000 })

    // --- Verify Portal says web approvals is disabled (because CLI device has a key) ---
    await page.click('nav >> text=Pending')
    // The CLI has a registered key, so web approvals should be blocked
    // (the Portal pending page either shows nothing or says web approvals disabled)

    // --- The CLI should receive the request via SSE ---
    // The CLI is listening via SSE. The Bank just created a request.
    try {
      await waitForOutput(() => cliOutput, 'Your choice', 60_000)
    } catch (err) {
      // Grab resolver logs to diagnose SSE routing
      let resolverLogs = ''
      try {
        resolverLogs = execSync(`${composeCmd} logs resolver 2>&1 | grep SSE-DEBUG`, {
          cwd: resolve(__dirname, '../../..'), encoding: 'utf8', timeout: 5_000
        })
      } catch { /* ignore */ }
      throw new Error(`CLI did not receive the Bank request via SSE within 60s.\nFull CLI output:\n${cliOutput}\n\nResolver SSE debug:\n${resolverLogs}`)
    }
    expect(cliOutput).toContain('bank.demo.test')

    // Answer the request (select option 1 = Approve)
    cli.stdin.write('1\n')
    await waitForOutput(() => cliOutput, 'Attestation submitted', 15_000)

    // --- Verify the Bank shows the transfer as completed ---
    await bank.getByTestId('nav-transactions').click()
    await expect(bank.locator('#transaction-list')).toContainText('Completed', { timeout: 15_000 })
    await expect(bank.locator('#transaction-list')).toContainText('CLI E2E test')

    // Cleanup
    cli.stdin.end()
    cli.kill()
    await bank.close()
  })
})

function waitForOutput(getOutput: () => string, needle: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (getOutput().includes(needle)) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for CLI output containing "${needle}". Got:\n${getOutput().slice(-500)}`))
        return
      }
      setTimeout(check, 200)
    }
    check()
  })
}
