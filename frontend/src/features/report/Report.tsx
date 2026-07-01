import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMonths, getReport, currentMonth } from '../../lib/data'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'

export function ReportTab() {
  const [month, setMonth] = useState(currentMonth())
  const { data: months = [] } = useQuery({ queryKey: ['months'], queryFn: getMonths })
  const { data: report, isLoading, error } = useQuery({ queryKey: ['report', month], queryFn: () => getReport(month), enabled: !!month })

  if (isLoading) return <LoadingState />
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"><h3 className="text-lg font-semibold text-red-300 mb-2">⚠️ Failed to load</h3><p className="text-red-200 text-sm">{(error as Error).message}</p></div>
  if (!report) return null

  const net = (report.total_income || 0) - (report.total_expenses || 0)
  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2">📊 Monthly Report</h1>
        <p className="text-sm text-slate-400">Detailed breakdown</p>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-50 focus:outline-none focus:border-blue-500 w-full md:w-64">
          {months.map((m: string) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Income</div>
          <div className="text-3xl font-bold text-emerald-300">{inr(report.total_income || 0)}</div>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Expenses</div>
          <div className="text-3xl font-bold text-orange-300">{inr(report.total_expenses || 0)}</div>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Net Savings</div>
          <div className={`text-3xl font-bold ${net >= 0 ? 'text-cyan-300' : 'text-red-300'}`}>{inr(net)}</div>
        </div>
      </div>
      {Object.keys(report.expenses_by_category || {}).length > 0 && (
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 border border-slate-700/60 rounded-2xl shadow-2xl p-8">
          <h3 className="text-xl font-semibold text-slate-100 mb-4">Expenses by Category</h3>
          <div className="space-y-2">
            {Object.entries(report.expenses_by_category).sort((a: any, b: any) => b[1] - a[1]).map(([cat, amt]: [string, any]) => (
              <div key={cat} className="flex justify-between items-center py-3 px-4 hover:bg-slate-700/20 rounded">
                <span className="text-slate-300">{cat}</span>
                <span className="font-semibold text-orange-300">{inr(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
