import { useState } from 'react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { TopNav } from './components/layout/TopNav'
import { BottomNav } from './components/layout/BottomNav'
import './styles/globals.css'

// Import feature components
import { DashboardTab } from './features/dashboard/Dashboard'
import { AccountsTab } from './features/accounts/Accounts'
import { ExpensesTab } from './features/expenses/Expenses'
import { IncomeTab } from './features/income/Income'
import { TransfersTab } from './features/transfers/Transfers'
import { DebtsTab } from './features/debts/Debts'
import { SubscriptionsTab } from './features/subscriptions/Subscriptions'
import { ReportTab } from './features/report/Report'

const queryClient = new QueryClient()

function App() {
  const [tab, setTab] = useState('dashboard')

  const renderTab = () => {
    switch (tab) {
      case 'dashboard':
        return <DashboardTab />
      case 'accounts':
        return <AccountsTab />
      case 'expenses':
        return <ExpensesTab />
      case 'income':
        return <IncomeTab />
      case 'transfers':
        return <TransfersTab />
      case 'debts':
        return <DebtsTab />
      case 'subscriptions':
        return <SubscriptionsTab />
      case 'report':
        return <ReportTab />
      default:
        return <DashboardTab />
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-50">
        <TopNav tab={tab} onTabChange={setTab} />
        
        <main className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-8">
          <div className="animate-fade-in">
            {renderTab()}
          </div>
        </main>

        <BottomNav tab={tab} onTabChange={setTab} />
      </div>
    </QueryClientProvider>
  )
}

export default App
