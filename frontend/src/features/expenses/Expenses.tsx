import { useQuery } from '@tanstack/react-query'
import { getExpenses } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function ExpensesTab() {
  const { data, isLoading, error } = useQuery({ queryKey: ['expenses'], queryFn: () => getExpenses() })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorBox msg={(error as Error).message} />

  const expenses = data?.data || []
  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">💸 Expenses</h1>
        <p className="text-sm text-slate-400">Track your spending</p>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Expenses</div>
        <div className="text-3xl font-bold bg-gradient-to-r from-orange-300 to-orange-200 bg-clip-text text-transparent">{inr(total)}</div>
        <div className="text-xs text-slate-500 mt-1">{expenses.length} transactions</div>
      </div>
      {expenses.length === 0 ? (
        <Empty label="No expenses recorded yet" />
      ) : (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-slate-800/30">
              <Th>Date</Th><Th>Description</Th><Th>Category</Th><Th right>Amount</Th>
            </tr></thead>
            <tbody>
              {expenses.map((e: any, i: number) => (
                <tr key={e.id || i} className="hover:bg-slate-800/30 transition-colors">
                  <Td>{e.date}</Td><Td>{e.description || '—'}</Td>
                  <Td><span className="inline-block px-2 py-1 rounded bg-slate-700/40 text-slate-200 text-xs">{e.category}</span></Td>
                  <Td right className="font-semibold text-orange-300">{inr(Number(e.amount))}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children, right }: any) { return <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-700/50 ${right ? 'text-right' : 'text-left'}`}>{children}</th> }
function Td({ children, right, className = '' }: any) { return <td className={`px-6 py-4 border-b border-slate-700/30 text-sm text-slate-300 ${right ? 'text-right' : ''} ${className}`}>{children}</td> }
function Empty({ label }: any) { return <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl p-16 text-center"><p className="text-slate-400 text-lg">{label}</p></div> }
function ErrorBox({ msg }: any) { return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{msg}</p></div> }
