import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'
import { LoadingState } from '../components/LoadingState'
import { useState } from 'react'

export function ReportTab() {
  const [month, setMonth] = useState('Jul 2026')
  const { data: months = [] } = useQuery({
    queryKey: ['months'],
    queryFn: () => api('/months'),
    staleTime: 1000 * 60 * 60,
  })
  
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['report', month],
    queryFn: () => api(`/report?month=${month}`),
    enabled: !!month,
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <LoadingState />
  if (error) return <div className="alert alert-error">Failed to load report</div>
  if (!report) return null

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="section-header">📊 Monthly Report</h1>
        <p className="body-sm">Detailed breakdown</p>
      </div>

      <div className="surface p-4">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="input w-full md:w-64">
          {months.map((m: string) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card stat-card-income">
          <div className="stat-label">Total Income</div>
          <div className="stat-value">{inr(report.total_income || 0)}</div>
        </div>
        <div className="stat-card stat-card-expense">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value">{inr(report.total_expenses || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Savings</div>
          <div className={`stat-value ${(report.total_income || 0) - (report.total_expenses || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {inr((report.total_income || 0) - (report.total_expenses || 0))}
          </div>
        </div>
      </div>

      {/* Categories */}
      {report.expenses_by_category && (
        <div className="surface-lg p-8">
          <h3 className="section-subheader">Expenses by Category</h3>
          <div className="space-y-3">
            {Object.entries(report.expenses_by_category).map(([cat, amt]: [string, any]) => (
              <div key={cat} className="flex justify-between items-center py-3 px-4 hover:bg-slate-700/20 rounded">
                <span className="body text-slate-300">{cat}</span>
                <span className="font-semibold text-orange-300">{inr(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
