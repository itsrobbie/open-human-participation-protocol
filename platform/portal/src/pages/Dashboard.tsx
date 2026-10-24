import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { api } from '../api/client'
import { ErrorState } from '../components/ErrorState'
import { DashboardSkeleton } from '../components/Skeleton'

const ONBOARDING_DISMISSED_KEY = 'ohpp_onboarding_dismissed'

export function Dashboard() {
  const { data: summary, isLoading, error, refetch } = useQuery({
    queryKey: ['user-summary'],
    queryFn: api.getUserSummary,
  })

  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true'
  )

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  if (isLoading) return <DashboardSkeleton />
  if (error) return <ErrorState message="Failed to load dashboard." onRetry={() => refetch()} />

  const hasDevice = summary!.activeDevices > 0
  const hasApp = summary!.activeApps > 0
  const hasPending = summary!.pendingCount > 0
  const allDone = hasDevice && hasApp

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" data-testid="ohpp.dashboard.heading">Dashboard</h1>

      {/* Onboarding guide — shows until user dismisses it */}
      {!dismissed && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-3">
            <h2 className="font-semibold text-indigo-900 dark:text-indigo-200">
              {allDone ? 'You\'re all set!' : 'Get started'}
            </h2>
            <button
              data-testid="ohpp.dashboard.dismiss-onboarding"
              onClick={dismiss}
              className="text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 text-sm"
              aria-label="Dismiss getting started guide"
            >
              Dismiss
            </button>
          </div>

          {allDone ? (
            <p className="text-sm text-indigo-700 dark:text-indigo-300">
              Your account is set up. When connected apps need your participation, requests will appear on the{' '}
              <Link to="/pending" className="font-medium underline">Pending</Link> page.
              {hasPending && <span className="font-medium"> You have {summary!.pendingCount} pending now.</span>}
            </p>
          ) : (
            <ol className="text-sm text-indigo-700 dark:text-indigo-300 space-y-3">
              <li className="flex items-start gap-3">
                <StepIndicator done={hasDevice} number={1} />
                <span className={hasDevice ? 'line-through opacity-60' : ''}>
                  <Link to="/devices" className="font-medium underline">Enable web approvals</Link> — register this browser so you can respond to requests here.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <StepIndicator done={hasApp} number={2} />
                <span className={hasApp ? 'line-through opacity-60' : ''}>
                  <Link to="/register-app" className="font-medium underline">Connect an app</Link> — paste the connection link from the app you want to use.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <StepIndicator done={hasPending} number={3} />
                <span className={hasPending ? 'line-through opacity-60' : ''}>
                  When the app needs your participation, respond on the{' '}
                  <Link to="/pending" className="font-medium underline">Pending</Link> page.
                </span>
              </li>
            </ol>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Devices" value={summary!.activeDevices} />
        <StatCard label="Connected Apps" value={summary!.activeApps} />
        <StatCard label="Pending Requests" value={summary!.pendingCount} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm dark:shadow-slate-900/20 border border-gray-200 dark:border-slate-700" data-testid="ohpp.dashboard.welcome">
        <h2 className="text-lg font-semibold mb-2">Welcome, {summary!.displayName}</h2>
        <p className="text-gray-600 dark:text-slate-400 text-sm">{summary!.email}</p>
      </div>
    </div>
  )
}

function StepIndicator({ done, number }: { done: boolean; number: number }) {
  if (done) {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  return (
    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
      {number}
    </span>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  const slug = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm dark:shadow-slate-900/20 border border-gray-200 dark:border-slate-700" data-testid={`ohpp.dashboard.stat.${slug}`}>
      <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
}
