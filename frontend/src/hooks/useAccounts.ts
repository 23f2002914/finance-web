import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface Account {
  id: number
  name: string
  account_type: string
  notes: string
  active: boolean
  sort_order: number
  closing_balance: number
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => api<Account[]>('/accounts'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useActiveAccounts() {
  return useQuery({
    queryKey: ['accounts-list'],
    queryFn: () => api<{ id: number; name: string }[]>('/accounts/list'),
    staleTime: 1000 * 60 * 5,
  })
}
