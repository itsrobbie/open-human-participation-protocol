import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

type Claim = components['schemas']['InsuranceClaim']
type ClaimScenario = components['schemas']['ClaimScenario']
type Policy = components['schemas']['InsurancePolicy']

let token = sessionStorage.getItem('ohpp-insurance-token')
let currentClaims: Claim[] = []
const policiesById = new Map<string, Policy>()

const element = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T

const scenarios: ReadonlyArray<readonly [ClaimScenario, string]> = [
  ['SelectDisposition', 'Select next action'],
  ['AffectedItems', 'Confirm affected items'],
  ['ClaimantNote', 'Add claimant note'],
  ['EstimatedAmount', 'Confirm estimated amount'],
  ['IncidentDate', 'Confirm incident date'],
  ['AdjusterAppointment', 'Choose adjuster appointment'],
  ['ClaimantDeclaration', 'Sign claimant declaration'],
]

// --- API client ---
const apiFetch: typeof fetch = async (input, init = {}) => {
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined))
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(input, { ...init, headers })
  if (response.status === 401 || response.status === 403) {
    signOut('Your Insurance Claims session has expired. Please sign in again.')
  }
  return response
}

const client = createClient<paths>({ baseUrl: '', fetch: apiFetch })

// --- Auth ---
async function signIn(username: string, password: string) {
  const { data: config, error } = await client.GET('/.well-known/ohpp/auth-config')
  if (!config) throw new Error(readableError(error, 'Could not load sign-in configuration'))
  if (!config.authority || !config.clientId) throw new Error('Sign-in configuration is incomplete')

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
  token = (await response.json() as { access_token: string }).access_token
  sessionStorage.setItem('ohpp-insurance-token', token)
}

function showApp() {
  element('login').hidden = true
  element('app').hidden = false
  showPage(routeFromHash())
}

function signOut(message = '') {
  token = null
  sessionStorage.removeItem('ohpp-insurance-token')
  element('app').hidden = true
  element('login').hidden = false
  element('login-result').textContent = message
}

// --- Login form ---
element<HTMLFormElement>('login-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const result = element('login-result')
  result.textContent = ''
  try {
    await signIn(
      element<HTMLInputElement>('username').value,
      element<HTMLInputElement>('password').value,
    )
    showApp()
    await loadWorkspace()
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : 'Could not sign in'
  }
})

element('logout-button').addEventListener('click', () => signOut())

// --- Routing ---
const pages = Array.from(document.querySelectorAll<HTMLElement>('[data-page]'))
const validRoutes = new Set(pages.map((page) => page.dataset.page!))

function routeFromHash() {
  const requested = window.location.hash.slice(1)
  return validRoutes.has(requested) ? requested : 'dashboard'
}

function showPage(route: string) {
  const selected = validRoutes.has(route) ? route : 'dashboard'
  for (const page of pages) page.hidden = page.dataset.page !== selected
  for (const link of Array.from(document.querySelectorAll<HTMLElement>('[data-route]'))) {
    if (link.dataset.route === selected) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
}

window.addEventListener('hashchange', () => showPage(routeFromHash()))
for (const button of Array.from(document.querySelectorAll<HTMLElement>('[data-route-button]'))) {
  button.addEventListener('click', () => { window.location.hash = button.dataset.routeButton! })
}

// --- Workspace loading ---
async function loadWorkspace() {
  await loadPolicies()
  await Promise.all([loadClaims(), loadConnectionStatus()])
}

// --- Policies ---
async function loadPolicies() {
  const { data: policies, error } = await client.GET('/api/policies')
  if (!policies) {
    element('policy-summary').textContent = readableError(error, 'Could not load policy.')
    return
  }

  policiesById.clear()
  for (const policy of policies) policiesById.set(policy.id, policy)

  const policySelect = element<HTMLSelectElement>('policy')
  policySelect.replaceChildren()
  for (const policy of policies) {
    const option = document.createElement('option')
    option.value = policy.id
    option.textContent = `${policy.policyNumber} - ${policy.status}`
    policySelect.append(option)
  }

  const summary = element('policy-summary')
  if (policies.length === 0) {
    summary.textContent = 'No active policies'
    return
  }
  const policy = policies[0]!
  summary.innerHTML = `${escapeHtml(policy.policyNumber)}<br><span style="font-size:.85rem; font-weight:400;">${formatMoney(policy.coverageLimit)} coverage - ${escapeHtml(policy.status)}</span>`
}

// --- Claims ---
async function loadClaims() {
  const { data: claims, error } = await client.GET('/api/claims')
  if (!claims) {
    element('claims-result').textContent = readableError(error, 'Could not load claims.')
    return
  }
  currentClaims = claims
  updateDashboardStats()
  renderClaims()
  renderRecentClaims()
}

function updateDashboardStats() {
  const total = currentClaims.length
  const pending = currentClaims.filter((c) => c.status === 'AwaitingParticipation').length
  const drafts = currentClaims.filter((c) => c.status === 'Draft').length
  const approved = currentClaims.filter((c) => c.status === 'ApprovedForNextStep').length
  const noun = total === 1 ? 'claim' : 'claims'

  element('claim-summary').innerHTML = `<strong>${total} total ${noun}</strong><br><span class="muted">${pending} awaiting participation</span>`

  const stats = element('dashboard-stats')
  stats.innerHTML = `
    <div class="stat"><strong>${drafts}</strong><small>Drafts</small></div>
    <div class="stat"><strong>${pending}</strong><small>Awaiting</small></div>
    <div class="stat"><strong>${approved}</strong><small>Approved</small></div>
    <div class="stat"><strong>${total}</strong><small>Total</small></div>
  `
}

function renderRecentClaims() {
  const container = element('recent-claims')
  const recent = currentClaims.slice(0, 3)
  if (recent.length === 0) {
    container.innerHTML = '<p class="muted">No claims yet. Submit your first claim to get started.</p>'
    return
  }
  container.replaceChildren()
  for (const claim of recent) {
    const item = document.createElement('div')
    item.style.cssText = 'padding:.8rem 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; gap:1rem;'
    const statusClass = claim.status.toLowerCase()
    item.innerHTML = `
      <div>
        <strong style="font-size:.92rem;">${escapeHtml(claim.claimNumber)}</strong>
        <p style="margin:.2rem 0 0; font-size:.82rem; color:var(--muted);">${escapeHtml(claim.description).slice(0, 60)}${claim.description.length > 60 ? '...' : ''}</p>
      </div>
      <span class="claim-status status-${statusClass}">${escapeHtml(claim.status)}</span>
    `
    container.append(item)
  }
}

function renderClaims() {
  const filter = element<HTMLSelectElement>('claim-status-filter').value
  const claims = filter === 'All'
    ? currentClaims
    : currentClaims.filter((c) => c.status === filter)
  const container = element('claims')
  const emptyEl = element('claims-empty')
  container.replaceChildren()
  emptyEl.hidden = claims.length > 0 || currentClaims.length === 0

  if (currentClaims.length === 0) {
    container.innerHTML = '<p class="muted">No claims yet.</p>'
    return
  }

  for (const claim of claims) container.append(createClaimCard(claim))
}

function createClaimCard(claim: Claim) {
  const card = document.createElement('article')
  card.className = 'claim-card'
  card.dataset.testid = `claim-${claim.id}`

  const statusClass = claim.status.toLowerCase()
  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:start; gap:1rem; flex-wrap:wrap;">
      <h3>${escapeHtml(claim.claimNumber)}</h3>
      <span class="claim-status status-${statusClass}">Status: ${escapeHtml(claim.status)}</span>
    </div>
    <p style="color:var(--muted); font-size:.88rem; margin:.4rem 0 .8rem;">${escapeHtml(claim.description)}</p>
  `

  const meta = document.createElement('div')
  meta.className = 'claim-meta'
  appendMeta(meta, 'Policy', policiesById.get(claim.policyId)?.policyNumber ?? claim.policyId)
  appendMeta(meta, 'Claimant', claim.claimantName)
  appendMeta(meta, 'Incident', formatDate(claim.incidentDate))
  appendMeta(meta, 'Incident time', formatDateTime(claim.incidentAt))
  appendMeta(meta, 'Estimate', formatMoney(claim.estimatedAmount))
  card.append(meta)

  for (const note of claim.notes) appendAnswerTag(card, `Note: ${note.body}`)
  if (claim.affectedItems.length) appendAnswerTag(card, `Affected items: ${claim.affectedItems.join(', ')}`)

  // Action buttons based on status
  if (claim.status === 'Submitted') {
    const actions = document.createElement('div')
    actions.style.cssText = 'display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; margin-top:1rem;'
    const select = document.createElement('select')
    select.setAttribute('aria-label', `Participation scenario for ${claim.claimNumber}`)
    select.dataset.testid = `participation-scenario-${claim.id}`
    for (const [value, label] of scenarios) {
      const option = document.createElement('option')
      option.value = String(value)
      option.textContent = label
      select.append(option)
    }
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Request human participation'
    button.dataset.testid = `request-participation-${claim.id}`
    button.addEventListener('click', async () => {
      const { error } = await client.POST('/api/claims/{id}/participation', {
        params: {
          path: { id: claim.id },
          query: { scenario: select.value as ClaimScenario },
        },
      })
      if (error) {
        showStatus(card, readableError(error, 'Could not request participation.'), 'error')
        return
      }
      await loadClaims()
      void pollClaimStatus(claim.id)
    })
    actions.append(select, button)
    card.append(actions)
  } else if (claim.status === 'Draft') {
    const submit = document.createElement('button')
    submit.type = 'button'
    submit.textContent = 'Submit draft'
    submit.dataset.testid = `submit-draft-${claim.id}`
    submit.style.marginTop = '1rem'
    submit.addEventListener('click', async () => {
      const { data, error } = await client.POST('/api/claims/{id}/submit', {
        params: { path: { id: claim.id } },
      })
      if (!data) showStatus(card, readableError(error, 'Could not submit draft.'), 'error')
      else await loadClaims()
    })
    card.append(submit)
  } else if (claim.status === 'AwaitingParticipation') {
    const refresh = document.createElement('button')
    refresh.type = 'button'
    refresh.textContent = 'Refresh participation status'
    refresh.className = 'secondary'
    refresh.dataset.testid = `refresh-participation-${claim.id}`
    refresh.style.marginTop = '1rem'
    refresh.addEventListener('click', () => void refreshClaimStatus(claim.id))
    card.append(refresh)
  }

  // Answer display
  if (claim.selectedOption) appendAnswerTag(card, `Answer: ${claim.selectedOption}`)
  else if (claim.selectedOptions?.length) appendAnswerTag(card, `Answers: ${claim.selectedOptions.join(', ')}`)
  else if (claim.answerValue) appendAnswerTag(card, `Answer: ${claim.answerValue}`)

  // Timeline
  const timeline = document.createElement('section')
  timeline.className = 'timeline'
  timeline.innerHTML = `
    <strong>Timeline</strong>
    <p>${claim.status === 'Draft' ? 'Draft saved' : 'Created'} ${formatDateTime(claim.createdAt)}</p>
    <p>Last updated ${formatDateTime(claim.updatedAt)}</p>
    ${claim.participationRequestId ? `<p>Participation request ${claim.participationRequestId}</p>` : ''}
  `
  card.append(timeline)

  return card
}

function appendMeta(container: HTMLElement, label: string, value: string) {
  if (!value) return
  const item = document.createElement('span')
  const strong = document.createElement('strong')
  strong.textContent = label
  item.append(strong, ' ', value)
  container.append(item)
}

function appendAnswerTag(card: HTMLElement, text: string) {
  const tag = document.createElement('span')
  tag.className = 'answer-tag'
  tag.textContent = text
  card.append(tag)
}

function showStatus(container: HTMLElement, message: string, type: 'success' | 'error' | 'pending') {
  let el = container.querySelector('.status') as HTMLElement | null
  if (!el) {
    el = document.createElement('p')
    container.append(el)
  }
  el.className = `status ${type}`
  el.textContent = message
}

// --- Claim form ---
element<HTMLFormElement>('claim-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  await submitClaim(false)
})
element('save-draft').addEventListener('click', async () => {
  await submitClaim(true)
})

async function submitClaim(isDraft: boolean) {
  const result = element('claim-result')
  result.className = ''
  result.textContent = ''

  const body = getClaimFormData()
  const { data, error } = await (isDraft
    ? client.POST('/api/claims/drafts', { body })
    : client.POST('/api/claims', { body }))

  if (!data) {
    result.className = 'status error'
    result.textContent = readableError(error, 'Could not submit claim.')
    return
  }
  result.className = 'status success'
  result.textContent = isDraft ? 'Draft saved successfully.' : `Claim ${data.claimNumber} submitted successfully.`
  element<HTMLFormElement>('claim-form').reset()
  element<HTMLInputElement>('claimant').value = 'Demo User'
  await loadClaims()
}

function getClaimFormData() {
  const affectedItems: string[] = []
  if (element<HTMLInputElement>('affected-building').checked) affectedItems.push('Building')
  if (element<HTMLInputElement>('affected-contents').checked) affectedItems.push('Contents')
  if (element<HTMLInputElement>('affected-accommodation').checked) affectedItems.push('Temporary accommodation')

  const note = element<HTMLTextAreaElement>('claimant-note').value.trim()
  return {
    policyId: element<HTMLSelectElement>('policy').value,
    claimantName: element<HTMLInputElement>('claimant').value,
    incidentDate: element<HTMLInputElement>('date').value,
    incidentAt: element<HTMLInputElement>('incident-at').value || undefined,
    description: element<HTMLTextAreaElement>('description').value,
    affectedItems,
    estimatedAmount: parseFloat(element<HTMLInputElement>('amount').value),
    claimantNote: note || undefined,
  }
}

// --- Participation ---
async function refreshClaimStatus(claimId: string) {
  const { data: claim, error } = await client.GET('/api/claims/{id}/participation/status', {
    params: { path: { id: claimId } },
  })
  if (!claim) {
    element('claims-result').textContent = readableError(error, 'Could not refresh participation status.')
    return null
  }
  await loadClaims()
  return claim
}

async function pollClaimStatus(claimId: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const claim = await refreshClaimStatus(claimId)
    if (!claim || claim.status !== 'AwaitingParticipation') return
  }
  element('claims-result').textContent = 'Timed out waiting for the participation response.'
}

// --- OHPP Connection ---
async function loadConnectionStatus() {
  const { data: result, error } = await client.GET('/api/ohpp/status')
  if (!result) {
    element('ohpp-result').textContent = readableError(error, 'Could not load the connection status.')
    return
  }
  const status = element('ohpp-status')
  status.textContent = result.connected ? 'Connected to the Resolver' : 'Not connected to the Resolver'
  status.className = result.connected ? 'success' : 'muted'

  const badge = element('dashboard-ohpp-status')
  badge.textContent = result.connected ? 'Connected' : 'Not connected'
  badge.className = `badge ${result.connected ? 'badge-connected' : 'badge-disconnected'}`
}

element('generate-challenge').addEventListener('click', async () => {
  const { data: challenge, error } = await client.POST('/api/ohpp/generate-challenge')
  if (!challenge) {
    element('ohpp-result').textContent = readableError(error, 'Could not generate a registration challenge.')
    return
  }
  element<HTMLTextAreaElement>('challenge-uri').value = challenge.challengeUri
  element('challenge-panel').hidden = false
  element('ohpp-result').className = 'status success'
  element('ohpp-result').textContent = 'Challenge ready. Copy and paste into the Portal "Connect App" page.'
})

element('copy-challenge').addEventListener('click', () => {
  const uri = element<HTMLTextAreaElement>('challenge-uri').value
  void navigator.clipboard.writeText(uri)
  element('ohpp-result').className = 'status success'
  element('ohpp-result').textContent = 'Challenge URI copied to clipboard.'
})

element('refresh-connection').addEventListener('click', async () => {
  await loadConnectionStatus()
  element('ohpp-result').className = 'status success'
  element('ohpp-result').textContent = 'Connection status refreshed.'
})

element('disconnect-ohpp').addEventListener('click', async () => {
  const { error } = await client.DELETE('/api/ohpp/disconnect')
  if (error) {
    element('ohpp-result').className = 'status error'
    element('ohpp-result').textContent = readableError(error, 'Could not revoke the connection.')
    return
  }
  element('challenge-panel').hidden = true
  element('ohpp-result').className = 'status success'
  element('ohpp-result').textContent = 'Resolver credentials revoked. Generate a new challenge to reconnect.'
  await loadConnectionStatus()
})

element<HTMLSelectElement>('claim-status-filter').addEventListener('change', renderClaims)

// --- Utilities ---
function readableError(error: unknown, fallback: string) {
  if (typeof error === 'string' && error) return error
  if (error && typeof error === 'object') {
    const body = error as Record<string, unknown>
    for (const key of ['error', 'detail', 'title']) {
      if (typeof body[key] === 'string' && body[key]) return body[key]
    }
  }
  return fallback
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
}

function formatDate(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`))
}

function formatDateTime(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date)
}

function escapeHtml(text: string) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// --- Init ---
if (token) {
  showApp()
  void loadWorkspace()
}
