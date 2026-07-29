import createClient from 'openapi-fetch'
import type { paths } from './schema'

const client = createClient<paths>({ baseUrl: '' })
const ACCOUNT_ID = 'demo-account'

// --- DOM references ---
const balanceEl = document.getElementById('balance')!
const ohppStatusEl = document.getElementById('ohpp-status')!
const payeeListEl = document.getElementById('payee-list')!
const payeeSelectEl = document.getElementById('payee-select') as HTMLSelectElement
const transferForm = document.getElementById('transfer-form') as HTMLFormElement
const amountInput = document.getElementById('amount') as HTMLInputElement
const referenceInput = document.getElementById('reference') as HTMLInputElement
const transferResultEl = document.getElementById('transfer-result')!
const ohppForm = document.getElementById('ohpp-form') as HTMLFormElement
const resolverUrlInput = document.getElementById('resolver-url') as HTMLInputElement
const accessTokenInput = document.getElementById('access-token') as HTMLInputElement
const userIdInput = document.getElementById('user-id') as HTMLInputElement
const ohppResultEl = document.getElementById('ohpp-result')!
const transactionListEl = document.getElementById('transaction-list')!

// --- Load account ---
async function loadAccount() {
  const { data } = await client.GET('/api/accounts/{id}', {
    params: { path: { id: ACCOUNT_ID } },
  })
  if (!data) return
  const account = data as { balance: number; ohppRegistration: unknown; payees: Array<{ id: string; name: string; sortCode: string; accountNumber: string }> }

  balanceEl.textContent = `£${account.balance.toFixed(2)}`

  if (account.ohppRegistration) {
    ohppStatusEl.innerHTML = '<span class="ohpp-badge">OHPP Connected</span> Transfers require approval'
  } else {
    ohppStatusEl.innerHTML = '<span style="color:#666;">OHPP not connected — transfers execute immediately</span>'
  }

  payeeListEl.innerHTML = ''
  payeeSelectEl.innerHTML = ''
  for (const p of account.payees) {
    payeeListEl.innerHTML += `<li><span>${p.name}</span><span style="color:#888;font-size:0.85rem">${p.sortCode} / ${p.accountNumber}</span></li>`
    payeeSelectEl.innerHTML += `<option value="${p.id}">${p.name}</option>`
  }
}

// --- Transaction History ---
interface TransactionRecord {
  id: string
  accountId: string
  payeeName: string
  amount: number
  reference: string | null
  status: string
  participationRequestId: string | null
  createdAt: string
  resolvedAt: string | null
}

async function loadTransactions() {
  const res = await fetch(`/api/transactions?accountId=${ACCOUNT_ID}`)
  if (!res.ok) return
  const transactions: TransactionRecord[] = await res.json()

  if (transactions.length === 0) {
    transactionListEl.innerHTML = '<p style="color:#888; font-size:0.85rem;">No transactions yet.</p>'
    return
  }

  transactionListEl.innerHTML = transactions.map((txn) => {
    const statusClass = txn.status.toLowerCase()
    const statusLabel = txn.status === 'PendingApproval' ? 'Pending' : txn.status
    const time = new Date(txn.createdAt).toLocaleString()
    const ref = txn.reference ? ` · ${txn.reference}` : ''
    return `
      <div class="txn-item">
        <div class="txn-left">
          <span class="txn-payee">${txn.payeeName}</span>
          <span class="txn-meta">${time}${ref}</span>
        </div>
        <div class="txn-right">
          <span class="txn-amount">£${txn.amount.toFixed(2)}</span>
          <span class="txn-status ${statusClass}">${statusLabel}</span>
        </div>
      </div>
    `
  }).join('')
}

// --- Transfer ---
transferForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const payeeId = payeeSelectEl.value
  const amount = parseFloat(amountInput.value)
  const reference = referenceInput.value

  transferResultEl.style.display = 'block'
  transferResultEl.className = 'status pending'
  transferResultEl.textContent = 'Processing...'

  const { data, error } = await client.POST('/api/transfers', {
    body: { fromAccountId: ACCOUNT_ID, toPayeeId: payeeId, amount, reference } as never,
  })

  const result = (data ?? error) as { status: number | string; participationRequestId?: string; error?: string }

  if (result.status === 'Completed' || result.status === 0) {
    transferResultEl.className = 'status success'
    transferResultEl.textContent = '✓ Transfer completed.'
    loadAccount()
    loadTransactions()
  } else if (result.status === 'PendingApproval' || result.status === 1) {
    transferResultEl.className = 'status pending'
    transferResultEl.textContent = `⏳ Waiting for approval on your device... (Request ID: ${result.participationRequestId})`
    loadTransactions()
    if (result.participationRequestId) pollStatus(result.participationRequestId)
  } else {
    transferResultEl.className = 'status error'
    transferResultEl.textContent = `✗ ${result.error || 'Transfer failed'}`
  }
})

async function pollStatus(requestId: string) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const { data } = await client.GET('/api/transfers/{requestId}/status', {
      params: { path: { requestId }, query: { accountId: ACCOUNT_ID } },
    })
    const result = data as { status: number | string; error?: string } | undefined
    if (!result) continue

    if (result.status === 'Completed' || result.status === 0) {
      transferResultEl.className = 'status success'
      transferResultEl.textContent = '✓ Transfer approved and completed.'
      loadAccount()
      loadTransactions()
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

// --- OHPP Settings ---
ohppForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const { error } = await client.POST('/api/ohpp/register', {
    body: {
      accountId: ACCOUNT_ID,
      resolverUrl: resolverUrlInput.value,
      accessToken: accessTokenInput.value,
      userId: userIdInput.value,
    } as never,
  })

  ohppResultEl.style.display = 'block'
  if (!error) {
    ohppResultEl.className = 'status success'
    ohppResultEl.textContent = '✓ OHPP connected. Transfers now require approval.'
    loadAccount()
  } else {
    ohppResultEl.className = 'status error'
    ohppResultEl.textContent = '✗ Failed to connect OHPP.'
  }
})

// --- Challenge generation ---
const generateBtn = document.getElementById('generate-challenge-btn')!
const challengeDisplay = document.getElementById('challenge-display')!
const challengeUriEl = document.getElementById('challenge-uri') as HTMLTextAreaElement
const copyBtn = document.getElementById('copy-challenge')!
const disconnectSection = document.getElementById('ohpp-disconnect-section')!
const disconnectBtn = document.getElementById('disconnect-btn')!

generateBtn.addEventListener('click', async () => {
  const res = await fetch('/api/ohpp/generate-challenge', { method: 'POST' })
  if (!res.ok) return

  const data = await res.json() as { challengeUri: string }
  challengeUriEl.value = data.challengeUri
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
  await fetch('/api/ohpp/disconnect', { method: 'DELETE' })
  loadAccount()
  disconnectSection.style.display = 'none'
})

async function pollForConnection() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const res = await fetch(`/api/accounts/${ACCOUNT_ID}`)
    if (!res.ok) continue
    const account = await res.json() as { ohppRegistration: unknown }
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

// --- Init ---
loadAccount()
loadTransactions()
