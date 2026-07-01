-- 003_realtime_rls_security.sql
-- Realtime publication + Row Level Security (permissive, no auth yet)

-- Enable Realtime on core transactional tables
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table income_entries;
alter publication supabase_realtime add table transfers;
alter publication supabase_realtime add table debt_entries;
alter publication supabase_realtime add table subscription_payments;
alter publication supabase_realtime add table bank_accounts;

-- Set REPLICA IDENTITY FULL so postgres_changes includes old row data
alter table expenses replica identity full;
alter table income_entries replica identity full;
alter table transfers replica identity full;
alter table debt_entries replica identity full;
alter table subscription_payments replica identity full;
alter table bank_accounts replica identity full;

-- Enable RLS on all tables with permissive policies
-- (RLS enabled but fully open — can be tightened later without schema rewrites)
alter table bank_accounts enable row level security;
create policy "allow all" on bank_accounts for all using (true) with check (true);

alter table account_openings enable row level security;
create policy "allow all" on account_openings for all using (true) with check (true);

alter table debt_creditors enable row level security;
create policy "allow all" on debt_creditors for all using (true) with check (true);

alter table debt_entries enable row level security;
create policy "allow all" on debt_entries for all using (true) with check (true);

alter table income_entries enable row level security;
create policy "allow all" on income_entries for all using (true) with check (true);

alter table expenses enable row level security;
create policy "allow all" on expenses for all using (true) with check (true);

alter table expense_splits enable row level security;
create policy "allow all" on expense_splits for all using (true) with check (true);

alter table budgets enable row level security;
create policy "allow all" on budgets for all using (true) with check (true);

alter table transfers enable row level security;
create policy "allow all" on transfers for all using (true) with check (true);

alter table subscriptions enable row level security;
create policy "allow all" on subscriptions for all using (true) with check (true);

alter table subscription_payments enable row level security;
create policy "allow all" on subscription_payments for all using (true) with check (true);

alter table _changelog enable row level security;
create policy "allow all" on _changelog for all using (true) with check (true);
