-- Setup database extensions
create extension if not exists "uuid-ossp";

-- --------------------------------------------------
-- 1. TABLE CREATION
-- --------------------------------------------------

-- Table 1: profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  version bigint default 1 not null
);

-- Table 2: groups
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  settings jsonb default '{"allocationMode": "DAILY"}'::jsonb not null, -- DAILY or MEAL mode
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  version bigint default 1 not null
);

-- Table 3: group_members
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  member_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('ADMIN', 'MEMBER')),
  joined_at timestamptz default now() not null,
  left_at timestamptz,
  status text not null check (status in ('ACTIVE', 'LEFT', 'PENDING')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  version bigint default 1 not null
);

-- Table 4: group_invitations
create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  email text not null,
  role text not null check (role in ('ADMIN', 'MEMBER')),
  token text unique not null,
  status text not null check (status in ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Table 5: shopping_logs
create table public.shopping_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  payer_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount >= 0),
  currency char(3) default 'VND' not null,
  note text not null,
  shopping_date date not null,
  expense_type text not null check (expense_type in ('MEAL', 'SHARED')) default 'MEAL',
  status text not null check (status in ('ACTIVE', 'VOID')),
  client_mutation_id uuid unique,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  version bigint default 1 not null
);

-- Table 6: attendance
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  member_id uuid not null references public.profiles(id) on delete restrict,
  date date not null,
  meal_type text not null check (meal_type in ('BREAKFAST', 'LUNCH', 'DINNER')),
  status text not null check (status in ('EATEN', 'NOT_EATEN')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Table 7: settlement_periods
create table public.settlement_periods (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null check (status in ('OPEN', 'LOCKED')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  version bigint default 1 not null
);

-- Table 8: payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  settlement_period_id uuid not null references public.settlement_periods(id) on delete restrict,
  payer_id uuid not null references public.profiles(id) on delete restrict,
  receiver_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount > 0),
  note text,
  payment_date date not null,
  status text not null check (status in ('PENDING', 'PAID')),
  client_mutation_id uuid unique,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  version bigint default 1 not null,
  constraint payments_payer_receiver_different check (payer_id != receiver_id)
);

-- Table 9: notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  type text not null,
  link text,
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

-- Table 10: audit_logs
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

-- --------------------------------------------------
-- 2. INDEXES
-- --------------------------------------------------

-- Ensure active/pending membership is unique per user per group
create unique index group_members_active_pending_uidx 
  on public.group_members (group_id, member_id) 
  where status = 'ACTIVE' or status = 'PENDING';

-- Unique constraint on attendance to avoid duplicate meal checks
create unique index attendance_group_member_date_meal_uidx 
  on public.attendance (group_id, member_id, date, meal_type);

-- Query optimizations
create index idx_shopping_logs_group_date on public.shopping_logs(group_id, shopping_date);
create index idx_shopping_logs_payer on public.shopping_logs(payer_id);
create index idx_attendance_group_date on public.attendance(group_id, date);
create index idx_group_members_user on public.group_members(member_id, status);
create index idx_payments_period on public.payments(settlement_period_id);
create index idx_settlement_periods_group on public.settlement_periods(group_id, start_date, end_date);
create index idx_audit_logs_group_date on public.audit_logs(group_id, created_at);

-- --------------------------------------------------
-- 3. TRIGGERS
-- --------------------------------------------------

-- Trigger: Update updated_at automatically
create or replace function public.handle_update_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_profiles before update on public.profiles for each row execute procedure public.handle_update_timestamp();
create trigger set_updated_at_groups before update on public.groups for each row execute procedure public.handle_update_timestamp();
create trigger set_updated_at_group_members before update on public.group_members for each row execute procedure public.handle_update_timestamp();
create trigger set_updated_at_shopping_logs before update on public.shopping_logs for each row execute procedure public.handle_update_timestamp();
create trigger set_updated_at_settlement_periods before update on public.settlement_periods for each row execute procedure public.handle_update_timestamp();
create trigger set_updated_at_payments before update on public.payments for each row execute procedure public.handle_update_timestamp();

-- Trigger: Sync profiles with auth.users
create or replace function public.handle_new_user()
returns trigger security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: Automatically make group creator an ADMIN
create or replace function public.handle_new_group()
returns trigger security definer as $$
begin
  if auth.uid() is not null then
    insert into public.group_members (group_id, member_id, role, status)
    values (new.id, auth.uid(), 'ADMIN', 'ACTIVE');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();

-- Trigger: Check locked settlement periods before mutation
create or replace function public.check_settlement_lock()
returns trigger security definer as $$
declare
  target_group_id uuid;
  target_date date;
begin
  if TG_OP = 'DELETE' then
    target_group_id := old.group_id;
    if TG_TABLE_NAME = 'shopping_logs' then
      target_date := old.shopping_date;
    elsif TG_TABLE_NAME = 'attendance' then
      target_date := old.date;
    elsif TG_TABLE_NAME = 'payments' then
      target_date := old.payment_date;
    end if;
  else
    target_group_id := new.group_id;
    if TG_TABLE_NAME = 'shopping_logs' then
      target_date := new.shopping_date;
    elsif TG_TABLE_NAME = 'attendance' then
      target_date := new.date;
    elsif TG_TABLE_NAME = 'payments' then
      target_date := new.payment_date;
    end if;
  end if;

  if exists (
    select 1 
    from public.settlement_periods 
    where group_id = target_group_id 
      and status = 'LOCKED' 
      and target_date between start_date and end_date
  ) then
    raise exception 'Thao tác bị từ chối: Kỳ quyết toán cho ngày % đã bị khóa.', target_date;
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql;

create trigger check_lock_shopping_logs
  before insert or update or delete on public.shopping_logs
  for each row execute procedure public.check_settlement_lock();

create trigger check_lock_attendance
  before insert or update or delete on public.attendance
  for each row execute procedure public.check_settlement_lock();

create trigger check_lock_payments
  before insert or update or delete on public.payments
  for each row execute procedure public.check_settlement_lock();

-- --------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invitations enable row level security;
alter table public.shopping_logs enable row level security;
alter table public.attendance enable row level security;
alter table public.settlement_periods enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Helper functions for RLS
create or replace function public.is_group_member(group_id uuid, user_id uuid)
returns boolean security definer as $$
begin
  return exists (
    select 1 
    from public.group_members 
    where group_members.group_id = is_group_member.group_id 
      and group_members.member_id = is_group_member.user_id 
      and group_members.status = 'ACTIVE'
  );
end;
$$ language plpgsql;

create or replace function public.is_group_admin(group_id uuid, user_id uuid)
returns boolean security definer as $$
begin
  return exists (
    select 1 
    from public.group_members 
    where group_members.group_id = is_group_admin.group_id 
      and group_members.member_id = is_group_admin.user_id 
      and group_members.role = 'ADMIN'
      and group_members.status = 'ACTIVE'
  );
end;
$$ language plpgsql;

-- Policies for profiles
create policy "Users can view their own profile and profiles of group members"
  on public.profiles for select
  using (
    id = auth.uid() 
    or exists (
      select 1 
      from public.group_members gm1 
      join public.group_members gm2 on gm1.group_id = gm2.group_id 
      where gm1.member_id = auth.uid() 
        and gm2.member_id = public.profiles.id 
        and gm1.status = 'ACTIVE' 
        and gm2.status = 'ACTIVE'
    )
  );

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Policies for groups
create policy "Active group members can view group"
  on public.groups for select
  using (public.is_group_member(id, auth.uid()));

create policy "All authenticated users can create groups"
  on public.groups for insert
  with check (auth.uid() is not null);

create policy "Group admins can update group details"
  on public.groups for update
  using (public.is_group_admin(id, auth.uid()));

-- Policies for group_members
create policy "Group members can view membership details in same group"
  on public.group_members for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Group admins can insert members"
  on public.group_members for insert
  with check (public.is_group_admin(group_id, auth.uid()));

create policy "Group admins can update memberships or members can leave"
  on public.group_members for update
  using (
    public.is_group_admin(group_id, auth.uid())
    or (member_id = auth.uid() and status = 'LEFT')
  );

create policy "Group admins can delete memberships"
  on public.group_members for delete
  using (public.is_group_admin(group_id, auth.uid()));

-- Policies for group_invitations
create policy "Admins can manage or invitee can view invitations"
  on public.group_invitations for select
  using (
    public.is_group_admin(group_id, auth.uid())
    or email = (select email from auth.users where id = auth.uid())
  );

create policy "Only group admins can invite"
  on public.group_invitations for insert
  with check (public.is_group_admin(group_id, auth.uid()));

create policy "Only group admins can update invitations"
  on public.group_invitations for update
  using (public.is_group_admin(group_id, auth.uid()));

create policy "Only group admins can delete invitations"
  on public.group_invitations for delete
  using (public.is_group_admin(group_id, auth.uid()));

-- Policies for shopping_logs
create policy "Group members can view shopping logs"
  on public.shopping_logs for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Group members can insert shopping logs"
  on public.shopping_logs for insert
  with check (public.is_group_member(group_id, auth.uid()));

create policy "Group members can update their own shopping logs or admins can update any"
  on public.shopping_logs for update
  using (
    public.is_group_admin(group_id, auth.uid())
    or (payer_id = auth.uid() and public.is_group_member(group_id, auth.uid()))
  );

-- (Delete policy is intentionally omitted; shopping logs cannot be hard deleted)

-- Policies for attendance
create policy "Group members can view attendance"
  on public.attendance for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Group members can insert attendance"
  on public.attendance for insert
  with check (public.is_group_member(group_id, auth.uid()));

create policy "Members can update own attendance or admins can update any"
  on public.attendance for update
  using (
    public.is_group_admin(group_id, auth.uid())
    or (member_id = auth.uid() and public.is_group_member(group_id, auth.uid()))
  );

create policy "Members can delete own attendance or admins can delete any"
  on public.attendance for delete
  using (
    public.is_group_admin(group_id, auth.uid())
    or (member_id = auth.uid() and public.is_group_member(group_id, auth.uid()))
  );

-- Policies for settlement_periods
create policy "Group members can view settlement periods"
  on public.settlement_periods for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Group admins can manage settlement periods"
  on public.settlement_periods for insert
  with check (public.is_group_admin(group_id, auth.uid()));

create policy "Group admins can update settlement periods"
  on public.settlement_periods for update
  using (public.is_group_admin(group_id, auth.uid()));

create policy "Group admins can delete settlement periods"
  on public.settlement_periods for delete
  using (public.is_group_admin(group_id, auth.uid()));

-- Policies for payments
create policy "Group members can view payments"
  on public.payments for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Group members can insert payments"
  on public.payments for insert
  with check (public.is_group_member(group_id, auth.uid()));

create policy "Participants or admins can update payments"
  on public.payments for update
  using (
    public.is_group_admin(group_id, auth.uid())
    or ((payer_id = auth.uid() or receiver_id = auth.uid()) and public.is_group_member(group_id, auth.uid()))
  );

create policy "Only group admins can delete payments"
  on public.payments for delete
  using (public.is_group_admin(group_id, auth.uid()));

-- Policies for notifications
create policy "Users can view their own notifications"
  on public.notifications for select
  using (receiver_id = auth.uid());

create policy "Users can update their own notifications"
  on public.notifications for update
  using (receiver_id = auth.uid());

create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (receiver_id = auth.uid());

create policy "Group members can insert notifications for others"
  on public.notifications for insert
  with check (public.is_group_member(group_id, auth.uid()));

-- Policies for audit_logs
create policy "Only group admins can view audit logs"
  on public.audit_logs for select
  using (public.is_group_admin(group_id, auth.uid()));

create policy "Group members can insert audit logs"
  on public.audit_logs for insert
  with check (public.is_group_member(group_id, auth.uid()));

-- (Update and delete policies are intentionally omitted; audit logs are write-once append-only)
