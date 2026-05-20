-- ============================================================
-- Subject configuration: correct max_marks & passing_marks
-- per subject code across all semesters.
-- ============================================================

create table if not exists public.subject_config (
  id          uuid primary key default gen_random_uuid(),
  semester    int  not null,
  subject_code text not null,
  max_marks   int  not null,
  pass_marks  int  not null,
  created_at  timestamptz not null default now(),
  unique (semester, subject_code)
);

alter table public.subject_config enable row level security;
create policy "Subject config readable by authenticated"
  on public.subject_config for select to authenticated using (true);
create policy "Admins manage subject config"
  on public.subject_config for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------
-- SEM 1
-- ----------------------------------------------------------------
insert into public.subject_config (semester, subject_code, max_marks, pass_marks) values
  (1, 'TH1',      80,  27),
  (1, 'TH1IA',    20,   7),
  (1, 'TH2',      80,  27),
  (1, 'TH2IA',    20,   7),
  (1, 'TH3',      80,  27),
  (1, 'TH3IA',    20,   7),
  (1, 'TH4AB',    80,  27),
  (1, 'TH4ABIA',  20,   7),
  (1, 'PR2',      50,  25),
  (1, 'PR3',     100,  50),
  (1, 'SESSIONAL',200, 100),  -- no explicit pass mark given; using 50 %
  (1, 'TOTAL',   750, 375)
on conflict (semester, subject_code) do update
  set max_marks = excluded.max_marks, pass_marks = excluded.pass_marks;

-- ----------------------------------------------------------------
-- SEM 2
-- ----------------------------------------------------------------
insert into public.subject_config (semester, subject_code, max_marks, pass_marks) values
  (2, 'TH1',      80,  27),
  (2, 'TH1IA',    20,   7),
  (2, 'TH2',      80,  27),
  (2, 'TH2IA',    20,   7),
  (2, 'TH3',      80,  27),
  (2, 'TH3IA',    20,   7),
  (2, 'TH4',      80,  27),
  (2, 'TH4IA',    20,   7),
  (2, 'PR2',      50,  25),
  (2, 'PR3',     100,  50),
  (2, 'SESSIONAL',200, 100),
  (2, 'TOTAL',   750, 375)
on conflict (semester, subject_code) do update
  set max_marks = excluded.max_marks, pass_marks = excluded.pass_marks;

-- ----------------------------------------------------------------
-- SEM 3
-- ----------------------------------------------------------------
insert into public.subject_config (semester, subject_code, max_marks, pass_marks) values
  (3, 'TH1',      80,  27),
  (3, 'TH1IA',    20,   7),
  (3, 'TH2',      80,  27),
  (3, 'TH2IA',    20,   7),
  (3, 'TH3',      80,  27),
  (3, 'TH3IA',    20,   7),
  (3, 'TH4',      80,  27),
  (3, 'TH4IA',    20,   7),
  (3, 'TH5',      80,  27),
  (3, 'TH5IA',    20,   7),
  (3, 'PR1',      50,  25),
  (3, 'PR2',      50,  25),
  (3, 'PR3',      25,  13),
  (3, 'PR4',      25,  13),
  (3, 'SESSIONAL',100,  50),
  (3, 'TOTAL',   750, 375)
on conflict (semester, subject_code) do update
  set max_marks = excluded.max_marks, pass_marks = excluded.pass_marks;

-- ----------------------------------------------------------------
-- SEM 4
-- ----------------------------------------------------------------
insert into public.subject_config (semester, subject_code, max_marks, pass_marks) values
  (4, 'TH1',      80,  27),
  (4, 'TH1IA',    20,   7),
  (4, 'TH2',      80,  27),
  (4, 'TH2IA',    20,   7),
  (4, 'TH3',      80,  27),
  (4, 'TH3IA',    20,   7),
  (4, 'TH4',      80,  27),
  (4, 'TH4IA',    20,   7),
  (4, 'PR1',      25,  13),
  (4, 'PR2',      50,  25),
  (4, 'PR3',      25,  13),
  (4, 'PR4',      50,  25),
  (4, 'SESSIONAL',200, 100),
  (4, 'TOTAL',   750, 375)
on conflict (semester, subject_code) do update
  set max_marks = excluded.max_marks, pass_marks = excluded.pass_marks;

-- ----------------------------------------------------------------
-- SEM 5
-- ----------------------------------------------------------------
insert into public.subject_config (semester, subject_code, max_marks, pass_marks) values
  (5, 'TH1',      80,  27),
  (5, 'TH1IA',    20,   7),
  (5, 'TH2',      80,  27),
  (5, 'TH2IA',    20,   7),
  (5, 'TH3',      80,  27),
  (5, 'TH3IA',    20,   7),
  (5, 'TH4',      80,  27),
  (5, 'TH4IA',    20,   7),
  (5, 'TH5',      80,  27),
  (5, 'TH5IA',    20,   7),
  (5, 'PR1',      50,  25),
  (5, 'PR2',      50,  25),
  (5, 'PR3',      50,  25),
  (5, 'SESSIONAL',100,  50),
  (5, 'TOTAL',   750, 375)
on conflict (semester, subject_code) do update
  set max_marks = excluded.max_marks, pass_marks = excluded.pass_marks;

-- ----------------------------------------------------------------
-- Helper function: look up max_marks for a (semester, subject_code).
-- Falls back to 100 if not configured so old data doesn't break.
-- ----------------------------------------------------------------
create or replace function public.get_subject_max_marks(
  _semester int,
  _subject_code text
) returns int
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select max_marks from public.subject_config
     where semester = _semester
       and subject_code = upper(_subject_code)
     limit 1),
    100
  )
$$;

-- ----------------------------------------------------------------
-- Helper function: look up pass_marks for a (semester, subject_code).
-- Falls back to 40 % of max if not configured.
-- ----------------------------------------------------------------
create or replace function public.get_subject_pass_marks(
  _semester int,
  _subject_code text
) returns int
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select pass_marks from public.subject_config
     where semester = _semester
       and subject_code = upper(_subject_code)
     limit 1),
    40 -- fallback: 40 out of 100
  )
$$;

-- ----------------------------------------------------------------
-- Back-fill existing results rows: fix max_marks & status for
-- any row whose subject_code matches a subject_config entry.
-- ----------------------------------------------------------------
update public.results r
set
  max_marks = sc.max_marks,
  status = case
    when r.marks is null then 'backlog'
    when r.marks < sc.pass_marks then
      -- preserve cleared backlog distinction
      case when r.cleared_backlog then 'pass' else
        case when r.status = 'backlog' then 'backlog' else 'fail' end
      end
    else 'pass'
  end
from public.subject_config sc
where upper(r.subject_code) = sc.subject_code
  and r.semester = sc.semester;
