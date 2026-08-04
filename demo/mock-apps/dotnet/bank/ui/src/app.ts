import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

type Account = components['schemas']['Account']
type TransactionRecord = components['schemas']['TransactionRecord']

let accessToken = localStorage.getItem('ohpp-bank-access-token')

const apiFetch: typeof fetch = async (input, init = {}) => {
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined))
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(input, { ...init, headers })
  if (response.status === 401 || response.status === 403) {
    signOut('Your Bank session has expired. Please sign in again.')
  }
  return response
}

const client = createClient<paths>({ baseUrl: '', fetch: apiFetch })
let activeAccountId = 'demo-account'
let accounts: Account[] = []
let transactions: TransactionRecord[] = []

const loginCard = document.getElementById('login-card')!
const bankApp = document.getElementById('bank-app')!
const appNav = document.getElementById('app-nav')!
const loginForm = document.getElementById('login-form') as HTMLFormElement
const loginResult = document.getElementById('login-result')!

async function signIn(username: string, password: string) {
  const { data: config } = await client.GET('/.well-known/ohpp/auth-config')
  if (!config?.authority || !config.clientId) throw new Error('Could not load sign-in configuration')
  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: 'password',
    username,
    password,
  })
  const response = await fetch(`${config.authority}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) throw new Error('Invalid demo credentials')
  accessToken = (await response.json() as { access_token: string }).access_token
  localStorage.setItem('ohpp-bank-access-token', accessToken)
}

function showAuthenticatedApp() {
  loginCard.hidden = true
  bankApp.hidden = false
  appNav.hidden = false
  showBankPage(routeFromHash())
}

function signOut(message = '') {
  accessToken = null
  localStorage.removeItem('ohpp-bank-access-token')
  loginCard.hidden = false
  bankApp.hidden = true
  loginResult.className = message ? 'status error' : ''
  loginResult.textContent = message
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  loginResult.className = 'status pending'
  loginResult.textContent = 'Signing in...'
  try {
    await signIn(
      (document.getElementById('login-username') as HTMLInputElement).value,
      (document.getElementById('login-password') as HTMLInputElement).value,
    )
    showAuthenticatedApp()
    await loadWorkspace()
  } catch (error) {
    loginResult.className = 'status error'
    loginResult.textContent = error instanceof Error ? error.message : 'Could not sign in'
  }
})

// --- DOM references ---
const balanceEl = document.getElementById('balance')!
const accountListEl = document.getElementById('account-list')!
const activeAccountEl = document.getElementById('active-account') as HTMLSelectElement
const ohppStatusEl = document.getElementById('ohpp-status')!
const payeeListEl = document.getElementById('payee-list')!
const payeeSelectEl = document.getElementById('payee-select') as HTMLSelectElement
const transferForm = document.getElementById('transfer-form') as HTMLFormElement
const amountInput = document.getElementById('amount') as HTMLInputElement
const referenceInput = document.getElementById('reference') as HTMLInputElement
const scheduleModeEl = document.getElementById('schedule-mode') as HTMLSelectElement
const scheduleDateEl = document.getElementById('schedule-date') as HTMLInputElement
const scheduleDateTimeEl = document.getElementById('schedule-datetime') as HTMLInputElement
const scheduleDateRowEl = document.getElementById('schedule-date-row')!
const scheduleDateTimeRowEl = document.getElementById('schedule-datetime-row')!
const transferResultEl = document.getElementById('transfer-result')!
const ohppResultEl = document.getElementById('ohpp-result')!
const transactionListEl = document.getElementById('transaction-list')!
const recentActivityEl = document.getElementById('recent-activity')!
const transactionSearchEl = document.getElementById('transaction-search') as HTMLInputElement
const transactionStatusFilterEl = document.getElementById('transaction-status-filter') as HTMLSelectElement
const transferReviewEl = document.getElementById('transfer-review')!
const confirmTransferEl = document.getElementById('confirm-transfer')!
const cancelTransferEl = document.getElementById('cancel-transfer')!

async function loadAccounts() {
  const { data } = await client.GET('/api/accounts')
  if (!data?.length) return
  accounts = data
  if (!accounts.some((account) => account.id === activeAccountId)) activeAccountId = accounts[0]!.id

  accountListEl.replaceChildren()
  activeAccountEl.replaceChildren()
  for (const account of accounts) {
    const card = document.createElement('article')
    card.className = 'account-card'
    const name = document.createElement('strong')
    name.textContent = account.name
    const balance = document.createElement('p')
    balance.textContent = formatMoney(account.balance)
    const identifier = document.createElement('small')
    identifier.textContent = account.id
    card.append(name, balance, identifier)
    accountListEl.append(card)

    const option = document.createElement('option')
    option.value = account.id
    option.textContent = account.name
    option.selected = account.id === activeAccountId
    activeAccountEl.append(option)
  }
}

// --- Load account ---
async function loadAccount() {
  const { data } = await client.GET('/api/accounts/{id}', {
    params: { path: { id: activeAccountId } },
  })
  if (!data) return
  const account = data

  balanceEl.textContent = formatMoney(account.balance)

  ohppStatusEl.replaceChildren()
  if (account.ohppRegistration) {
    const badge = document.createElement('span')
    badge.className = 'ohpp-badge'
    badge.textContent = 'OHPP Connected'
    ohppStatusEl.append(badge, ' Transfers require approval')
    generateBtn.textContent = 'Generate new connection link'
    document.getElementById('ohpp-disconnect-section')!.style.display = 'block'
  } else {
    const disconnected = document.createElement('span')
    disconnected.style.color = '#666'
    disconnected.textContent = 'OHPP not connected. Transfers execute immediately.'
    ohppStatusEl.append(disconnected)
    document.getElementById('ohpp-connect-section')!.removeAttribute('hidden')
    generateBtn.textContent = 'Generate connection link'
    document.getElementById('ohpp-disconnect-section')!.style.display = 'none'
  }

  payeeListEl.replaceChildren()
  payeeSelectEl.replaceChildren()
  for (const p of account.payees) {
    const item = document.createElement('li')
    const name = document.createElement('span')
    name.textContent = p.name
    const details = document.createElement('span')
    details.style.color = '#888'
    details.style.fontSize = '0.85rem'
    details.textContent = `${p.sortCode} / ${p.accountNumber}`
    item.append(name, details)
    payeeListEl.append(item)

    const option = document.createElement('option')
    option.value = p.id
    option.textContent = p.name
    payeeSelectEl.append(option)
  }
}

async function loadTransactions() {
  const { data } = await client.GET('/api/transactions', {
    params: { query: { accountId: activeAccountId } },
  })
  if (!data) return
  transactions = data
  renderTransactions()
}

function renderTransactions() {
  const search = transactionSearchEl.value.trim().toLowerCase()
  const statusFilter = transactionStatusFilterEl.value
  const filtered = transactions.filter((transaction) => {
    const matchesSearch = !search || transaction.payeeName.toLowerCase().includes(search) || transaction.reference?.toLowerCase().includes(search)
    const matchesStatus = statusFilter === 'All' || transaction.status === statusFilter
    return matchesSearch && matchesStatus
  })

  transactionListEl.replaceChildren()
  if (filtered.length === 0) {
    const empty = document.createElement('p')
    empty.style.color = '#888'
    empty.style.fontSize = '0.85rem'
    empty.textContent = transactions.length === 0 ? 'No transactions yet.' : 'No transactions match your filters.'
    transactionListEl.append(empty)
    return
  }

  for (const txn of filtered) {
    const statusClass = txn.status.toLowerCase()
    const statusLabel = txn.status === 'PendingApproval' ? 'Pending' : txn.status
    const time = new Date(txn.createdAt).toLocaleString()
    const ref = txn.reference ? ` · ${txn.reference}` : ''
    const item = document.createElement('div')
    item.className = 'txn-item'
    const left = document.createElement('div')
    left.className = 'txn-left'
    const payee = document.createElement('span')
    payee.className = 'txn-payee'
    payee.textContent = txn.payeeName
    const metadata = document.createElement('span')
    metadata.className = 'txn-meta'
    const request = txn.participationRequestId ? ` · Request ${txn.participationRequestId}` : ''
    const scheduled = txn.scheduledFor ? ` · Scheduled ${new Date(txn.scheduledFor).toLocaleString()}` : ''
    metadata.textContent = `${time}${ref}${scheduled}${request}`
    left.append(payee, metadata)
    const right = document.createElement('div')
    right.className = 'txn-right'
    const amount = document.createElement('span')
    amount.className = 'txn-amount'
    amount.textContent = `£${txn.amount.toFixed(2)}`
    const status = document.createElement('span')
    status.className = `txn-status ${statusClass}`
    status.textContent = statusLabel
    right.append(amount, status)
    item.append(left, right)
    transactionListEl.append(item)
  }

  const recentItems = Array.from(transactionListEl.children).slice(0, 5).map((child) => {
    const clone = child.cloneNode(true) as HTMLElement
    clone.classList.remove('txn-item')
    clone.classList.add('recent-item')
    return clone
  })
  recentActivityEl.replaceChildren(...recentItems)
}

const bankPages = Array.from(document.querySelectorAll<HTMLElement>('[data-bank-page]'))
const bankRoutes = new Set(bankPages.map((page) => page.dataset.bankPage!))
const routeAliases: Record<string, string> = { account: 'overview', transfer: 'payments', history: 'transactions', ohpp: 'settings' }

function routeFromHash() {
  const requested = window.location.hash.slice(1)
  const resolved = routeAliases[requested] ?? requested
  return bankRoutes.has(resolved) ? resolved : 'overview'
}

function showBankPage(route: string) {
  const selectedRoute = bankRoutes.has(route) ? route : 'overview'
  for (const page of bankPages) page.hidden = page.dataset.bankPage !== selectedRoute
  for (const link of Array.from(document.querySelectorAll<HTMLElement>('[data-bank-route]'))) {
    if (link.dataset.bankRoute === selectedRoute) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
}

window.addEventListener('hashchange', () => showBankPage(routeFromHash()))
for (const button of Array.from(document.querySelectorAll<HTMLElement>('[data-route-button]'))) {
  button.addEventListener('click', () => { window.location.hash = button.dataset.routeButton! })
}

async function loadWorkspace() {
  // Transaction refresh can settle reviewed transfers and change the balance.
  await loadAccounts()
  await loadTransactions()
  await loadAccount()
}

activeAccountEl.addEventListener('change', async () => {
  activeAccountId = activeAccountEl.value
  transferReviewEl.hidden = true
  pendingTransfer = null
  await loadTransactions()
  await loadAccount()
})

transactionSearchEl.addEventListener('input', renderTransactions)
transactionStatusFilterEl.addEventListener('change', renderTransactions)

document.getElementById('add-payee-form')!.addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  const result = document.getElementById('payee-result')!
  const { error } = await client.POST('/api/payees', {
    body: {
      accountId: activeAccountId,
      name: (document.getElementById('payee-name') as HTMLInputElement).value,
      sortCode: (document.getElementById('payee-sort-code') as HTMLInputElement).value,
      accountNumber: (document.getElementById('payee-account-number') as HTMLInputElement).value,
    },
  })
  if (error) {
    result.className = 'status error'
    result.textContent = 'Could not add payee.'
    return
  }
  result.className = 'status success'
  result.textContent = 'Payee added.'
  form.reset()
  await loadAccount()
})

// --- Transfer ---
let pendingTransfer: { payeeId: string; amount: number; reference: string; scheduledFor?: string } | null = null

scheduleModeEl.addEventListener('change', () => {
  scheduleDateRowEl.hidden = scheduleModeEl.value !== 'date'
  scheduleDateTimeRowEl.hidden = scheduleModeEl.value !== 'datetime'
  scheduleDateEl.required = scheduleModeEl.value === 'date'
  scheduleDateTimeEl.required = scheduleModeEl.value === 'datetime'
})

transferForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const payeeId = payeeSelectEl.value
  const amount = parseFloat(amountInput.value)
  const reference = referenceInput.value
  const scheduleValue = scheduleModeEl.value === 'date'
    ? scheduleDateEl.value ? `${scheduleDateEl.value}T09:00:00` : ''
    : scheduleModeEl.value === 'datetime' ? scheduleDateTimeEl.value : ''
  const scheduledFor = scheduleValue ? new Date(scheduleValue).toISOString() : undefined

  pendingTransfer = { payeeId, amount, reference, scheduledFor }
  document.getElementById('review-account')!.textContent = accounts.find((account) => account.id === activeAccountId)?.name ?? activeAccountId
  document.getElementById('review-payee')!.textContent = payeeSelectEl.selectedOptions[0]?.textContent ?? payeeId
  document.getElementById('review-amount')!.textContent = formatMoney(amount)
  document.getElementById('review-reference')!.textContent = reference || 'No reference'
  document.getElementById('review-schedule')!.textContent = scheduledFor
    ? new Date(scheduledFor).toLocaleString()
    : 'Immediately'
  transferReviewEl.hidden = false
  confirmTransferEl.focus()
})

confirmTransferEl.addEventListener('click', async () => {
  if (!pendingTransfer) return
  const { payeeId, amount, reference, scheduledFor } = pendingTransfer

  transferResultEl.style.display = 'block'
  transferResultEl.className = 'status pending'
  transferResultEl.textContent = 'Processing...'

  const { data, error, response } = await client.POST('/api/transfers', {
    params: {},
    body: { fromAccountId: activeAccountId, toPayeeId: payeeId, amount, reference, scheduledFor },
  })

  const result = (data ?? error) as { status?: number | string; participationRequestId?: string; error?: string; title?: string; detail?: string } | undefined

  if (result?.status === 'Completed' || result?.status === 0) {
    transferResultEl.className = 'status success'
    transferResultEl.textContent = '✓ Transfer completed.'
    await loadAccount()
    await loadTransactions()
  } else if (result?.status === 'PendingApproval' || result?.status === 1) {
    transferResultEl.className = 'status pending'
    transferResultEl.textContent = `⏳ Waiting for approval on your device... (Request ID: ${result.participationRequestId})`
    await loadTransactions()
    if (result.participationRequestId) pollStatus(result.participationRequestId)
  } else if (result?.status === 'Scheduled' || result?.status === 5) {
    transferResultEl.className = 'status success'
    transferResultEl.textContent = '✓ Transfer scheduled.'
    await loadTransactions()
  } else {
    transferResultEl.className = 'status error'
    transferResultEl.textContent = `✗ ${result?.error || result?.title || result?.detail || `HTTP ${response.status}`}`
  }
  transferReviewEl.hidden = true
  pendingTransfer = null
})

cancelTransferEl.addEventListener('click', () => {
  transferReviewEl.hidden = true
  pendingTransfer = null
  amountInput.focus()
})

async function pollStatus(requestId: string) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const { data } = await client.GET('/api/transfers/{requestId}/status', {
      params: { path: { requestId }, query: { accountId: activeAccountId } },
    })
    const result = data as { status: number | string; error?: string } | undefined
    if (!result) continue

    if (result.status === 'Completed' || result.status === 0) {
      transferResultEl.className = 'status success'
      transferResultEl.textContent = '✓ Transfer approved and completed.'
      await loadAccount()
      await loadTransactions()
      return
    } else if (result.status === 'Scheduled' || result.status === 5) {
      transferResultEl.className = 'status success'
      transferResultEl.textContent = '✓ Transfer approved and scheduled.'
      await loadTransactions()
      return
    } else if (result.status === 'Denied' || result.status === 2) {
      transferResultEl.className = 'status error'
      transferResultEl.textContent = '✗ Transfer denied by user.'
      loadTransactions()
      return
    } else if (result.status === 'Failed' || result.status === 3) {
      transferResultEl.className = 'status error'
      transferResultEl.textContent = `✗ ${result.error || 'Transfer failed'}`
      loadTransactions()
      return
    }
  }
  transferResultEl.className = 'status error'
  transferResultEl.textContent = '✗ Timed out waiting for approval.'
}

// --- Challenge generation ---
const generateBtn = document.getElementById('generate-challenge-btn')!
const challengeDisplay = document.getElementById('challenge-display')!
const challengeUriEl = document.getElementById('challenge-uri') as HTMLTextAreaElement
const copyBtn = document.getElementById('copy-challenge')!
const disconnectSection = document.getElementById('ohpp-disconnect-section')!
const disconnectBtn = document.getElementById('disconnect-btn')!

generateBtn.addEventListener('click', async () => {
  const { data } = await client.POST('/api/ohpp/generate-challenge', {
    body: { accountId: activeAccountId },
  })
  if (!data) return
  challengeUriEl.value = (data as { challengeUri: string }).challengeUri
  challengeDisplay.style.display = 'block'

  // Start polling for connection (callback will arrive once user approves in Portal)
  pollForConnection()
})

copyBtn.addEventListener('click', () => {
  challengeUriEl.select()
  navigator.clipboard.writeText(challengeUriEl.value)
  copyBtn.textContent = 'Copied!'
  setTimeout(() => { copyBtn.textContent = 'Copy to clipboard' }, 2000)
})

disconnectBtn.addEventListener('click', async () => {
  await client.DELETE('/api/ohpp/disconnect', { params: { query: { accountId: activeAccountId } } })
  loadAccount()
  disconnectSection.style.display = 'none'
})

async function pollForConnection() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const { data } = await client.GET('/api/accounts/{id}', {
      params: { path: { id: activeAccountId } },
    })
    const account = data as { ohppRegistration: unknown } | undefined
    if (!account) continue
    if (account.ohppRegistration) {
      ohppResultEl.style.display = 'block'
      ohppResultEl.className = 'status success'
      ohppResultEl.textContent = '✓ OHPP connected via registration ceremony!'
      challengeDisplay.style.display = 'none'
      loadAccount()
      return
    }
  }
}

// --- Protocol scenario fixtures ---
const protocolScenarioEl = document.getElementById('protocol-scenario') as HTMLSelectElement
const createProtocolScenarioEl = document.getElementById('create-protocol-scenario')!
const refreshProtocolScenarioEl = document.getElementById('refresh-protocol-scenario')!
const protocolScenarioResultEl = document.getElementById('protocol-scenario-result')!
let protocolScenarioRequestId: string | null = null

createProtocolScenarioEl.addEventListener('click', async () => {
  protocolScenarioResultEl.className = 'status pending'
  protocolScenarioResultEl.textContent = 'Creating participation request...'
  const { data, error } = await client.POST('/api/ohpp/scenarios/{scenario}', {
    params: { path: { scenario: protocolScenarioEl.value as components['schemas']['BankProtocolScenario'] } },
    body: { accountId: activeAccountId },
  })
  if (!data || error) {
    protocolScenarioResultEl.className = 'status error'
    protocolScenarioResultEl.textContent = 'Could not create the protocol scenario. Connect OHPP first.'
    return
  }
  protocolScenarioRequestId = data.requestId ?? null
  protocolScenarioResultEl.className = 'status pending'
  protocolScenarioResultEl.textContent = `Awaiting human participation. Request ${protocolScenarioRequestId}`
  refreshProtocolScenarioEl.hidden = false
})

refreshProtocolScenarioEl.addEventListener('click', async () => {
  if (!protocolScenarioRequestId) return
  const { data } = await client.GET('/api/ohpp/scenarios/{requestId}/status', {
    params: {
      path: { requestId: protocolScenarioRequestId },
      query: { accountId: activeAccountId },
    },
  })
  if (!data) return
  if (data.status !== 'Resolved') {
    protocolScenarioResultEl.className = data.status === 'Expired' ? 'status error' : 'status pending'
    protocolScenarioResultEl.textContent = data.status ?? 'Pending'
    return
  }
  if (!data.attestationVerified) {
    protocolScenarioResultEl.className = 'status error'
    protocolScenarioResultEl.textContent = `Attestation verification failed: ${data.error ?? 'unknown error'}`
    return
  }
  const answer = data.selectedOption ?? data.selectedOptions?.join(', ') ?? data.value ?? 'acknowledged'
  protocolScenarioResultEl.className = 'status success'
  protocolScenarioResultEl.textContent = `Verified bank interpretation: ${answer}`
})

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
}

// --- Init ---
document.getElementById('logout-button')!.addEventListener('click', () => signOut())
if (accessToken) {
  showAuthenticatedApp()
  void loadWorkspace()
}
