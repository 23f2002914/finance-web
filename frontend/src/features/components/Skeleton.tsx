export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg shimmer ${className}`} />
}
