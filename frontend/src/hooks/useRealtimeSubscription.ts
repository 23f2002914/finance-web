import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useRealtimeSubscription(
  table: string,
  onChanges: (payload: any) => void,
  filter?: string
) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}${filter ? `:${filter}` : ''}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        onChanges
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter])
}
