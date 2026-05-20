
-- Branches
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  created_at timestamptz not null default now()
);
alter table public.branches enable row level security;
create policy "Branches readable by all authenticated" on public.branches
  for select to authenticated using (true);
create policy "Admins manage branches" on public.branches
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

-- Batches
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  branch text,
  created_at timestamptz not null default now(),
  unique (year, branch)
);
alter table public.batches enable row level security;
create policy "Batches readable by all authenticated" on public.batches
  for select to authenticated using (true);
create policy "Admins manage batches" on public.batches
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

-- Backlog clearance tracking on results
alter table public.results
  add column if not exists cleared_backlog boolean not null default false;

-- Helpful indexes
create index if not exists results_branch_batch_sem_idx
  on public.results (branch, batch_year, semester);
create index if not exists results_subject_code_idx
  on public.results (subject_code);
