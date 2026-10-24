-- Level-based Vocab Flashcards: tables in SafeOrder's shared Supabase project.
-- Apply in the Supabase SQL editor. Safe to re-run. Not managed by
-- `supabase db push` (that history belongs to the SafeOrder repo; SPEC §5).
-- Nothing here touches SafeOrder's tables.

-- Per-user settings: last language plus per-language session settings.
create table if not exists public.fc_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_language text,
  prefs jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Per-word results, kept separately for each direction (SPEC §6.2).
create table if not exists public.fc_word_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  direction text not null check (direction in ('forward', 'reverse')),
  language text not null,
  seen int not null default 0,
  correct int not null default 0,
  missed int not null default 0,
  streak int not null default 0,
  box smallint not null default 0 check (box between 0 and 5),
  due_at timestamptz,
  last_seen_at timestamptz,
  primary key (user_id, card_id, direction)
);
create index if not exists fc_word_stats_language on public.fc_word_stats (user_id, language);

-- Starred words: per word, covering both directions.
create table if not exists public.fc_starred (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  language text not null,
  starred_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- Finished sessions. The client generates the id so a retried insert is harmless.
create table if not exists public.fc_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null,
  min_level int not null,
  max_level int not null,
  direction text not null,
  selection text not null,
  planned_length int,
  shown int not null,
  correct int not null,
  missed int not null,
  started_at timestamptz not null,
  ended_at timestamptz not null
);
create index if not exists fc_sessions_user on public.fc_sessions (user_id, language, ended_at desc);

-- Grade batches already applied, so an upload retried after a lost response
-- is not counted twice.
create table if not exists public.fc_grade_batches (
  user_id uuid not null references auth.users (id) on delete cascade,
  batch_id uuid not null,
  applied_at timestamptz not null default now(),
  primary key (user_id, batch_id)
);

-- Row-level security: each person sees and changes only their own rows.
do $$
declare t text;
begin
  foreach t in array array['fc_settings', 'fc_word_stats', 'fc_starred', 'fc_sessions', 'fc_grade_batches'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Apply a batch of grades in order (SPEC §6.2–6.3). Leitner boxes 0–5 with
-- intervals 0, 1, 3, 7, 14, 30 days: Got it moves up a box, Missed resets to 0.
-- p_grades: [{"card_id", "direction", "language", "got": bool, "at": timestamptz}, …]
create or replace function public.fc_record_grades(p_batch uuid, p_grades jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  days int[] := array[0, 1, 3, 7, 14, 30];
  g jsonb;
  ok boolean;
  at timestamptz;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if jsonb_typeof(p_grades) <> 'array' or jsonb_array_length(p_grades) > 500 then
    raise exception 'p_grades must be an array of at most 500 grades';
  end if;

  insert into fc_grade_batches (user_id, batch_id) values (uid, p_batch) on conflict do nothing;
  if not found then
    return; -- already applied
  end if;

  for g in select value from jsonb_array_elements(p_grades) loop
    ok := (g ->> 'got')::boolean;
    at := least(coalesce((g ->> 'at')::timestamptz, now()), now());
    insert into fc_word_stats as s
      (user_id, card_id, direction, language, seen, correct, missed, streak, box, due_at, last_seen_at)
    values (
      uid, g ->> 'card_id', g ->> 'direction', g ->> 'language',
      1, ok::int, (not ok)::int, ok::int,
      case when ok then 1 else 0 end,
      at + make_interval(days => days[case when ok then 2 else 1 end]),
      at
    )
    on conflict (user_id, card_id, direction) do update set
      seen = s.seen + 1,
      correct = s.correct + ok::int,
      missed = s.missed + (not ok)::int,
      streak = case when ok then s.streak + 1 else 0 end,
      box = case when ok then least(s.box + 1, 5) else 0 end,
      due_at = excluded.last_seen_at
        + make_interval(days => days[(case when ok then least(s.box + 1, 5) else 0 end) + 1]),
      last_seen_at = greatest(s.last_seen_at, excluded.last_seen_at);
  end loop;
end;
$$;

revoke all on function public.fc_record_grades(uuid, jsonb) from public, anon;
grant execute on function public.fc_record_grades(uuid, jsonb) to authenticated;
