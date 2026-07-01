import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { inr } from '../../lib/formatters'

export function DebtsTab() {
  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['debts'],
    queryFn: () => api('/debts'),
    staleTime: 1000 * 60 * 5,
  })
  const queryClient = useQueryClient()
  const payDebtMutation = useMutation({
    mutationFn: ({ id, amount, full }: any) =>
      api(`/debts/${id}/pay`, { method: 'POST', body: { amount_paid: amount, full } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debts'] }),
  })

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [paymentDialog, setPaymentDialog] = useState<any>(null)

  if (isLoading) return <div>Loading debts...</div>

  return (
    <div>
      <h1 className="section-header">Debts & Subscriptions</h1>
      
      {debts.map((monthData: any) => (
        <div key={monthData.month} className="card mb-4">
          <button
            onClick={() => setExpandedMonth(expandedMonth === monthData.month ? null : monthData.month)}
            className="w-full text-left font-semibold flex justify-between items-center"
          >
            <span>{monthData.month}</span>
            <span className="text-lg">{expandedMonth === monthData.month ? '−' : '+'}</span>
          </button>

          {expandedMonth === monthData.month && (
            <div className="mt-4 space-y-2">
              {monthData.creditors?.map((cred: any) => {
                const entry = monthData.entries[cred.id]
                if (!entry) return null
                
                const statusColor =
                  entry.status === 'paid' ? 'text-income' :
                  entry.status === 'partial' ? 'text-yellow-600' :
                  'text-slate-600'

                return (
                  <div key={cred.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded">
                    <div>
                      <div className="font-medium">{cred.name}</div>
                      <div className="text-sm">
                        Owed: {inr(entry.amount)} | Paid: {inr(entry.amount_paid)} | Remaining: {inr(entry.amount - entry.amount_paid)}
                      </div>
                      <div className={`text-sm font-semibold ${statusColor}`}>{entry.status.toUpperCase()}</div>
                    </div>
                    <button
                      onClick={() => setPaymentDialog(entry)}
                      className="btn-primary text-sm"
                    >
                      Pay
                    </button>
                  </div>
                )
              })}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between font-semibold">
                  <span>Subscriptions:</span>
                  <span>{inr(monthData.subscriptions)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg mt-2">
                  <span>Total:</span>
                  <span>{inr(monthData.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {paymentDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-sm">
            <h2 className="font-bold mb-4">Record Payment</h2>
            <p className="mb-4">Owed: {inr(paymentDialog.amount)} | Remaining: {inr(paymentDialog.amount - paymentDialog.amount_paid)}</p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  payDebtMutation.mutate({ id: paymentDialog.id, full: true })
                  setPaymentDialog(null)
                }}
                className="w-full btn-primary"
              >
                Mark Fully Paid
              </button>
              <button
                onClick={() => {
                  const amount = prompt('Enter payment amount:')
                  if (amount) {
                    payDebtMutation.mutate({ id: paymentDialog.id, amount: parseFloat(amount) })
                    setPaymentDialog(null)
                  }
                }}
                className="w-full btn-secondary"
              >
                Record Partial Payment
              </button>
              <button onClick={() => setPaymentDialog(null)} className="w-full btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
