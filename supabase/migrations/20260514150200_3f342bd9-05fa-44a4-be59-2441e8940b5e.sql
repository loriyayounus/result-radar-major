-- Roles
create type public.app_role as enum ('admin', 'student');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can view own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "Admins can view all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  registration_no text unique,
  branch text,
  batch_year int,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles readable by self or admin" on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "Users can insert own profile" on public.profiles for insert to authenticated
  with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "Admins can insert any profile" on public.profiles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- Subjects (master subject info per semester/branch)
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text,
  semester int not null,
  branch text,
  max_marks int not null default 100,
  created_at timestamptz not null default now(),
  unique (code, semester, branch)
);
alter table public.subjects enable row level security;
create policy "Subjects readable by all authenticated" on public.subjects for select to authenticated using (true);
create policy "Admins manage subjects" on public.subjects for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Results
create table public.results (
  id uuid primary key default gen_random_uuid(),
  registration_no text not null,
  student_name text,
  branch text,
  batch_year int,
  semester int not null,
  subject_code text not null,
  subject_name text,
  marks numeric,
  max_marks numeric default 100,
  status text not null default 'pass', -- pass | fail | backlog
  created_at timestamptz not null default now(),
  unique (registration_no, semester, subject_code)
);

create index results_reg_idx on public.results (registration_no);
create index results_sem_idx on public.results (semester);
create index results_branch_idx on public.results (branch);
create index results_subject_idx on public.results (subject_code);

alter table public.results enable row level security;

-- Students can view results matching their registration_no via profile
create or replace function public.current_user_reg_no()
returns text language sql stable security definer set search_path = public
as $$ select registration_no from public.profiles where id = auth.uid() limit 1 $$;

create policy "Students view own results" on public.results for select to authenticated
  using (registration_no = public.current_user_reg_no());
create policy "Admins view all results" on public.results for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage results" on public.results for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + role on signup; role taken from raw_user_meta_data.role ('admin'|'student')
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_role public.app_role;
begin
  v_role := coalesce(nullif(new.raw_user_meta_data->>'role',''), 'student')::public.app_role;
  insert into public.profiles (id, full_name, registration_no, branch, batch_year)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    nullif(new.raw_user_meta_data->>'registration_no',''),
    nullif(new.raw_user_meta_data->>'branch',''),
    nullif(new.raw_user_meta_data->>'batch_year','')::int
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, v_role)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();