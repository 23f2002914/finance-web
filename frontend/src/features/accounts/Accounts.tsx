import { useState } from 'react'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount, Account } from './hooks'
import { AccountsTable } from './AccountsTable'

export function AccountsTab() {
  const { data: accounts = [], isLoading } = useAccounts()
  const createAcc = useCreateAccount()
  const updateAcc = useUpdateAccount()
  const deleteAcc = useDeleteAccount()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [formData, setFormData] = useState({ name: '', account_type: 'Bank', notes: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) {
      await updateAcc.mutateAsync({ id: editing.id, ...formData })
      setEditing(null)
    } else {
      await createAcc.mutateAsync(formData)
    }
    setFormData({ name: '', account_type: 'Bank', notes: '' })
    setShowForm(false)
  }

  const handleEdit = (acc: Account) => {
    setEditing(acc)
    setFormData({ name: acc.name, account_type: acc.account_type, notes: acc.notes })
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="section-header">Accounts</h1>
        <button onClick={() => { setShowForm(true); setEditing(null); setFormData({ name: '', account_type: 'Bank', notes: '' }); }} className="btn-primary">
          + New Account
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6">
          <h2 className="font-semibold mb-4">{editing ? 'Edit Account' : 'New Account'}</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Account name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded"
              required
            />
            <select
              value={formData.account_type}
              onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            >
              <option>Bank</option>
              <option>Wallet</option>
              <option>Cash</option>
            </select>
            <input
              type="text"
              placeholder="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <AccountsTable accounts={accounts} onEdit={handleEdit} onDelete={(id) => deleteAcc.mutateAsync(id)} />
      )}
    </div>
  )
}
