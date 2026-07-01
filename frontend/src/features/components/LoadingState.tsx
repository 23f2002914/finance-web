import { Skeleton } from './Skeleton'

export function LoadingState() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  )
}

export function TableLoadingState() {
  return (
    <div className="surface-lg p-8">
      <Skeleton className="h-8 w-1/4 mb-6" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-12 mb-3" />
      ))}
    </div>
  )
}
