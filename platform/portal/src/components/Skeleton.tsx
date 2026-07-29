/**
 * Skeleton loading primitives.
 * Use these to build page-specific loading states that match the final layout shape.
 */

function Base({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`}
      aria-hidden="true"
    />
  )
}

/** A single line of text */
export function SkeletonLine({ width = 'w-full' }: { width?: string }) {
  return <Base className={`h-4 ${width}`} />
}

/** A stat card (Dashboard) */
export function SkeletonStatCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm dark:shadow-slate-900/20 border border-gray-200 dark:border-slate-700">
      <Base className="h-3 w-20 mb-3" />
      <Base className="h-8 w-16" />
    </div>
  )
}

/** A list card (Devices, Apps, History) */
export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm dark:shadow-slate-900/20 border border-gray-200 dark:border-slate-700 flex justify-between items-center">
      <div className="flex-1 space-y-2">
        <Base className="h-4 w-40" />
        <Base className="h-3 w-56" />
        <Base className="h-3 w-32" />
      </div>
      <Base className="h-6 w-14 rounded" />
    </div>
  )
}

/** A pending request card */
export function SkeletonRequestCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm dark:shadow-slate-900/20 border border-gray-200 dark:border-slate-700">
      <div className="flex justify-between items-start mb-3">
        <div className="space-y-2 flex-1">
          <Base className="h-5 w-48" />
          <Base className="h-3 w-36" />
        </div>
        <Base className="h-3 w-24" />
      </div>
      <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-slate-700 mt-3">
        <Base className="h-9 flex-1 rounded-md" />
        <Base className="h-9 flex-1 rounded-md" />
      </div>
    </div>
  )
}

/** Dashboard loading skeleton */
export function DashboardSkeleton() {
  return (
    <div>
      <Base className="h-7 w-32 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm dark:shadow-slate-900/20 border border-gray-200 dark:border-slate-700 space-y-3">
        <Base className="h-5 w-40" />
        <Base className="h-3 w-56" />
      </div>
    </div>
  )
}

/** List page loading skeleton (Devices, Apps, History) */
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div>
      <Base className="h-7 w-48 mb-6" />
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

/** Pending page loading skeleton */
export function PendingSkeleton() {
  return (
    <div>
      <Base className="h-7 w-48 mb-4" />
      <Base className="h-4 w-72 mb-6" />
      <div className="space-y-4">
        <SkeletonRequestCard />
        <SkeletonRequestCard />
      </div>
    </div>
  )
}
