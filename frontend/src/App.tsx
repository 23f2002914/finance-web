import { useState, Suspense } from 'react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { TopNav } from './components/layout/TopNav'
import { BottomNav } from './components/layout/BottomNav'
import './styles/globals.css'

// Tab components
import { DashboardTab } from './features/dashboard/Dashboard'
import { AccountsTab } from './features/accounts/Accounts'
import { ExpensesTab } from './features/expenses/Expenses'
import { IncomeTab } from './features/income/Income'
import { TransfersTab } from './features/transfers/Transfers'
import { DebtsTab } from './features/debts/Debts'
import { SubscriptionsTab } from './features/subscriptions/Subscriptions'
import { ReportTab } from './features/report/Report'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, gcTime: 1000 * 60 * 10 },
  },
})

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="space-y-4 w-full max-w-6xl px-4">
        <div className="h-12 bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl shimmer" />
          ))}
        </div>
      </div>
    </div>
  )
}

function App() {
  const [tab, setTab] = useState('dashboard')

  const renderTab = () => {
    const tabs: Record<string, JSX.Element> = {
      dashboard: <DashboardTab />,
      accounts: <AccountsTab />,
      expenses: <ExpensesTab />,
      income: <IncomeTab />,
      transfers: <TransfersTab />,
      debts: <DebtsTab />,
      subscriptions: <SubscriptionsTab />,
      report: <ReportTab />,
    }
    return tabs[tab] || tabs.dashboard
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
        <TopNav tab={tab} onTabChange={setTab} />
        
        <main className="container mx-auto max-w-7xl px-4 py-8 pb-28 md:pb-12">
          <Suspense fallback={<LoadingState />}>
            <div className="fade-in-up">
              {renderTab()}
            </div>
          </Suspense>
        </main>

        <BottomNav tab={tab} onTabChange={setTab} />
      </div>
    </QueryClientProvider>
  )
}

export default App
