import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type HistoryEntry } from '../api/client'
import { History } from './History'

const queryOverride = vi.hoisted(() => ({ current: undefined as unknown }))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...original,
    useQuery: (...args: Parameters<typeof original.useQuery>) =>
      queryOverride.current ?? original.useQuery(...args),
  }
})

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, getHistory: vi.fn() } }
})

const getHistory = vi.mocked(api.getHistory)

function entry(id: string, status = 'Resolved'): HistoryEntry {
  return {
    id,
    requestId: `request-${id}`,
    appId: 'bank.test',
    appName: id === 'second' ? 'Insurance' : 'Bank',
    actionSummary: `Action ${id}`,
    type: 'Select',
    category: 'test',
    status,
    resolutionMethod: 'Web',
    createdAt: '2026-08-01T08:00:00Z',
    resolvedAt: '2026-08-01T08:01:00Z',
  }
}

function renderHistory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><History /></QueryClientProvider>)
}

describe('History', () => {
  beforeEach(() => {
    getHistory.mockReset()
    queryOverride.current = undefined
  })

  it('History_RendersLoadingState', async () => {
    let resolveHistory!: (value: Awaited<ReturnType<typeof api.getHistory>>) => void
    getHistory.mockReturnValue(new Promise((resolve) => { resolveHistory = resolve }))
    const { container } = renderHistory()

    expect(container.querySelectorAll('.animate-pulse')).not.toHaveLength(0)
    await act(async () => resolveHistory({ items: [], totalCount: 0, page: 1, pageSize: 20 }))
    expect(await screen.findByText('No participation records yet')).toBeInTheDocument()
  })

  it('History_RendersErrorState', async () => {
    queryOverride.current = {
      data: undefined,
      isLoading: false,
      error: new Error('offline'),
      refetch: vi.fn(),
    }
    renderHistory()

    expect(screen.getByText('Failed to load history.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('History_RendersEmptyAndPopulatedStates', async () => {
    getHistory.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 })
    const view = renderHistory()
    expect(await screen.findByText('No participation records yet')).toBeInTheDocument()

    view.unmount()
    getHistory.mockResolvedValue({ items: [entry('first')], totalCount: 1, page: 1, pageSize: 20 })
    renderHistory()
    expect(await screen.findByText('Action first')).toBeInTheDocument()
    expect(screen.getByText('Bank (bank.test) · Select · test')).toBeInTheDocument()
  })

  it('History_PaginatesAndRefetchesTheSelectedPage', async () => {
    getHistory.mockImplementation(async (page) => ({
      items: [entry(page === 1 ? 'first' : 'second')],
      totalCount: 21,
      page,
      pageSize: 20,
    }))
    const user = userEvent.setup()
    renderHistory()
    expect(await screen.findByText('Action first')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Action second')).toBeInTheDocument()
    expect(getHistory).toHaveBeenLastCalledWith(2, 20)
  })

  it('History_FiltersByTextAndStatus', async () => {
    getHistory.mockResolvedValue({
      items: [entry('first'), entry('second', 'Pending')],
      totalCount: 2,
      page: 1,
      pageSize: 20,
    })
    const user = userEvent.setup()
    renderHistory()
    await screen.findByText('Action first')

    await user.type(screen.getByPlaceholderText('Search by app or action...'), 'Insurance')
    expect(screen.queryByText('Action first')).not.toBeInTheDocument()
    expect(screen.getByText('Action second')).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('Search by app or action...'))
    await user.selectOptions(screen.getByRole('combobox'), 'Resolved')
    await waitFor(() => expect(screen.queryByText('Action second')).not.toBeInTheDocument())
  })
})
