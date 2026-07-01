import { Account } from './hooks'
import { inr } from '../../lib/formatters'

interface Props {
  accounts: Account[]
  onEdit: (account: Account) => void
  onDelete: (id: number) => void
}

export function AccountsTable({ accounts, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-100 dark:bg-slate-800">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Account</th>
            <th className="px-4 py-3 text-left font-semibold">Type</th>
            <th className="px-4 py-3 text-right font-semibold">Balance</th>
            <th className="px-4 py-3 text-center font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(acc => (
            <tr key={acc.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
              <td className="px-4 py-3">
                <div className="font-medium">{acc.name}</div>
                <div className="text-sm text-slate-600">{acc.notes}</div>
              </td>
              <td className="px-4 py-3">{acc.account_type}</td>
              <td className="px-4 py-3 text-right font-semibold">{inr(acc.closing_balance)}</td>
              <td className="px-4 py-3 text-center">
                <button onClick={() => onEdit(acc)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                <button onClick={() => onDelete(acc.id)} className="text-red-600 hover:text-red-800">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
