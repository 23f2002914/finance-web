import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'
import { useState } from 'react'

export function ReportTab() {
  const { data: months = [] } = useQuery({
    queryKey: ['months'],
    queryFn: () => api('/months'),
  })
  const [selectedMonth, setSelectedMonth] = useState<string>()
  const { data: report, isLoading } = useQuery({
    queryKey: ['report', selectedMonth],
    queryFn: () => api(`/report?month=${selectedMonth}`),
    enabled: !!selectedMonth,
    staleTime: 1000 * 60 * 5,
  })

  return (
    <div>
      <h1 className="section-header">Monthly Report</h1>
      <div className="mb-6">
        <select
          value={selectedMonth || ''}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded"
        >
          <option value="">Select a month...</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {!selectedMonth && <p>Select a month to view the report</p>}

      {selectedMonth && isLoading && <p>Loading report...</p>}

      {report && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold mb-4">Account Balances</h2>
            <div className="space-y-2">
              {Object.entries(report.accounts || {}).map(([name, acc]: [string, any]) => (
                <div key={name} className="flex justify-between">
                  <span>{name}</span>
                  <span className="font-semibold">{inr(acc.closing)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <h2 className="font-semibold mb-2">Income</h2>
              <div className="space-y-1 text-sm">
                {Object.entries(report.income_by_category || {}).map(([cat, amt]: [string, any]) => (
                  <div key={cat} className="flex justify-between">
                    <span>{cat}</span>
                    <span>{inr(amt)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="font-semibold mb-2">Expenses</h2>
              <div className="space-y-1 text-sm">
                {Object.entries(report.expenses_by_category || {}).map(([cat, amt]: [string, any]) => (
                  <div key={cat} className="flex justify-between">
                    <span>{cat}</span>
                    <span>{inr(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
