-- 002_rpc_functions.sql
-- Server-side aggregation functions (replaces N+1 queries from the app)

create or replace function acc_summary(p_month text default null)
returns table(account text, opening numeric, income numeric,
              transfers_in numeric, transfers_out numeric,
              expenses numeric, closing numeric)
language sql stable as $$
  with accts as (
    select name from bank_accounts where active = true
  ),
  openings as (
    select ba.name as account,
           case when p_month is null
                then (select opening_balance from account_openings ao
                      where ao.account = ba.name
                      order by to_date(ao.month, 'Mon YYYY') asc limit 1)
                else (select opening_balance from account_openings ao
                      where ao.account = ba.name and ao.month = p_month)
           end as opening
    from accts ba
  ),
  inc as (
    select account, coalesce(sum(amount),0) as income
    from income_entries
    where coalesce(deleted,false)=false and (p_month is null or month = p_month)
    group by account
  ),
  exp as (
    select account, coalesce(sum(amount),0) as expenses
    from expenses
    where coalesce(deleted,false)=false and (p_month is null or month = p_month)
    group by account
  ),
  tin as (
    select to_account as account, coalesce(sum(amount),0) as transfers_in
    from transfers
    where coalesce(deleted,false)=false and (p_month is null or month = p_month)
    group by to_account
  ),
  tout as (
    select from_account as account, coalesce(sum(amount),0) as transfers_out
    from transfers
    where coalesce(deleted,false)=false and (p_month is null or month = p_month)
    group by from_account
  )
  select a.name,
         coalesce(o.opening,0),
         coalesce(i.income,0),
         coalesce(tin.transfers_in,0),
         coalesce(tout.transfers_out,0),
         coalesce(e.expenses,0),
         coalesce(o.opening,0)+coalesce(i.income,0)+coalesce(tin.transfers_in,0)
           -coalesce(e.expenses,0)-coalesce(tout.transfers_out,0)
  from accts a
  left join openings o  on o.account=a.name
  left join inc i        on i.account=a.name
  left join exp e        on e.account=a.name
  left join tin          on tin.account=a.name
  left join tout         on tout.account=a.name;
$$;

create or replace function sub_monthly_total()
returns numeric
language sql stable as $$
  select coalesce(sum(case when billing_cycle='annual' then amount/12 else amount end),0)
  from subscriptions
  where status='active' and deleted=false;
$$;

create or replace function subscription_cycle_status()
returns void
language sql as $$
  update subscription_payments
  set status = 'overdue'
  where status = 'due' and due_date < current_date;
$$;
