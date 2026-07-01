export function BottomNav({ tab, onTabChange }: { tab: string; onTabChange: (t: string) => void }) {
  const tabs = [
    { id: 'dashboard', label: '📊', title: 'Dashboard' },
    { id: 'expenses', label: '💸', title: 'Expenses' },
    { id: 'income', label: '💰', title: 'Income' },
    { id: 'debts', label: '💳', title: 'Debts' },
    { id: 'report', label: '📋', title: 'Report' },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 safe-area-inset-bottom">
      <div className="flex">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition ${
              tab === t.id ? 'text-blue-600' : 'text-slate-600 dark:text-slate-400'
            }`}
            title={t.title}
          >
            <span className="text-lg">{t.label}</span>
            <span className="text-xs">{t.title}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
