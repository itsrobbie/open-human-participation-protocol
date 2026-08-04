import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import { Pending } from './Pending'

vi.mock('../auth/token', () => ({ ensureFreshToken: vi.fn().mockResolvedValue('access-token') }))

const requests = [
  {
    id: 'select-request',
    appId: 'bank.test',
    actionSummary: 'Choose one',
    description: 'Select one app option',
    rationale: null,
    type: 'select',
    options: [{ key: 'custom-key', label: 'Custom option' }],
    placeholder: null,
    masked: false,
    keyboard: null,
    expiresAt: null,
    createdAt: '2026-08-01T08:00:00Z',
  },
  {
    id: 'multi-request',
    appId: 'insurance.test',
    actionSummary: 'Choose several',
    description: null,
    rationale: null,
    type: 'multiselect',
    options: [
      { key: 'alpha', label: 'Alpha' },
      { key: 'beta', label: 'Beta' },
    ],
    placeholder: null,
    masked: false,
    keyboard: null,
    expiresAt: null,
    createdAt: '2026-08-01T08:00:00Z',
  },
]

function renderPending() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider><Pending /></ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Pending protocol controls', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('Pending_SelectAndMultiselect_RenderAppOptionsAndSubmitTypedAnswers', async () => {
    const submitted: unknown[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/status')) return new Response(JSON.stringify({ enabled: true, reason: null }))
      if (url.endsWith('/pending')) return new Response(JSON.stringify(requests))
      if (url.includes('/resolve')) {
        submitted.push(JSON.parse(String(init?.body)))
        return new Response(null, { status: 200 })
      }
      return new Response(null, { status: 404 })
    }))
    const user = userEvent.setup()
    renderPending()

    await user.click(await screen.findByRole('button', { name: 'Custom option' }))
    await waitFor(() => expect(submitted).toContainEqual({ selectedOption: 'custom-key' }))

    await user.click(screen.getByRole('checkbox', { name: 'Alpha' }))
    await user.click(screen.getByRole('checkbox', { name: 'Beta' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(submitted).toContainEqual({ selectedOptions: ['alpha', 'beta'] }))
  })
})
