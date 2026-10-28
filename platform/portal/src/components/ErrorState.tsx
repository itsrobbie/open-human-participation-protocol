interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-6 text-center">
      <div className="text-red-600 dark:text-red-400 mb-2">
        <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="text-red-800 dark:text-red-200 font-medium text-sm" data-testid="ohpp.errorstate.message">{message}</p>
      {onRetry && (
        <button
          data-testid="ohpp.errorstate.retry"
          onClick={onRetry}
          className="mt-3 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/40 rounded-md hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  )
}
