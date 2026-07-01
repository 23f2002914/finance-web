export function TopNav({ tab, onTabChange }: { tab: string; onTabChange: (t: string) => void }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'income', label: 'Income' },
    { id: 'transfers', label: 'Transfers' },
    { id: 'debts', label: 'Debts' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'report', label: 'Report' },
  ]

  return (
    <nav className="hidden md:flex border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-40">
      <div className="max-w-7xl mx-auto flex w-full">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
