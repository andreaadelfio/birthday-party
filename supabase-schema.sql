create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_default boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surname text not null,
  full_name text not null,
  email citext not null unique,
  guests_count integer not null default 1 check (guests_count between 1 and 10),
  notes text,
  group_id uuid not null references public.guest_groups(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.music_profiles (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.event_registrations(id) on delete cascade,
  instruments text[] not null default '{}',
  styles text[] not null default '{}',
  genres text[] not null default '{}',
  collaboration_modes text[] not null default '{}',
  availability_notes text,
  performance_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint music_profiles_instruments_not_empty check (cardinality(instruments) > 0),
  constraint music_profiles_styles_not_empty check (cardinality(styles) > 0),
  constraint music_profiles_genres_not_empty check (cardinality(genres) > 0)
);

create index if not exists event_registrations_group_id_idx
  on public.event_registrations(group_id);

create index if not exists music_profiles_updated_at_idx
  on public.music_profiles(updated_at desc);

alter table public.event_registrations
  add column if not exists name text,
  add column if not exists surname text,
  add column if not exists full_name text;

update public.event_registrations
set
  name = coalesce(
    nullif(trim(name), ''),
    split_part(trim(coalesce(full_name, '')), ' ', 1)
  ),
  surname = coalesce(
    nullif(trim(surname), ''),
    case
      when strpos(trim(coalesce(full_name, '')), ' ') > 0 then
        trim(substr(trim(coalesce(full_name, '')), strpos(trim(coalesce(full_name, '')), ' ') + 1))
      else
        ''
    end
  ),
  full_name = trim(
    concat_ws(
      ' ',
      coalesce(nullif(trim(name), ''), split_part(trim(coalesce(full_name, '')), ' ', 1)),
      coalesce(
        nullif(trim(surname), ''),
        case
          when strpos(trim(coalesce(full_name, '')), ' ') > 0 then
            trim(substr(trim(coalesce(full_name, '')), strpos(trim(coalesce(full_name, '')), ' ') + 1))
          else
            ''
        end
      )
    )
  )
where
  name is null
  or surname is null
  or full_name is null;

alter table public.event_registrations
  alter column name set default '',
  alter column surname set default '',
  alter column full_name set default '';

update public.event_registrations
set
  name = coalesce(name, ''),
  surname = coalesce(surname, ''),
  full_name = coalesce(full_name, trim(concat_ws(' ', name, surname)));

alter table public.event_registrations
  alter column name set not null,
  alter column surname set not null,
  alter column full_name set not null;

insert into public.guest_groups (name, slug, is_default, sort_order)
values
  ('Default', 'default', true, 0),
  ('Triestini', 'triestini', false, 10),
  ('Palermitani', 'palermitani', false, 20),
  ('Munichers', 'munichers', false, 30)
on conflict (slug) do update
set
  name = excluded.name,
  is_default = excluded.is_default,
  sort_order = excluded.sort_order;

alter table public.guest_groups enable row level security;
alter table public.event_registrations enable row level security;
alter table public.music_profiles enable row level security;

drop policy if exists "Public can read guest groups" on public.guest_groups;
create policy "Public can read guest groups"
on public.guest_groups
for select
to anon, authenticated
using (true);

drop function if exists public.register_guest(text, text, integer, text, text, text);
create or replace function public.register_guest(
  p_name text,
  p_surname text,
  p_email text,
  p_guests_count integer default 1,
  p_notes text default null,
  p_group_slug text default 'default',
  p_new_group_name text default null
)
returns table (
  registration_id uuid,
  registration_email citext,
  group_slug text,
  group_name text,
  saved_mode text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_group_slug text;
  v_group_name text;
  v_email citext;
  v_full_name text;
  v_registration_id uuid;
  v_registration_exists boolean;
begin
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Name is required';
  end if;

  if nullif(trim(coalesce(p_surname, '')), '') is null then
    raise exception 'Surname is required';
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'Email is required';
  end if;

  if coalesce(p_guests_count, 0) < 1 then
    raise exception 'Guests count must be at least 1';
  end if;

  v_email := lower(trim(p_email))::citext;
  v_full_name := trim(concat_ws(' ', trim(p_name), trim(p_surname)));

  if nullif(trim(coalesce(p_new_group_name, '')), '') is not null then
    v_group_name := trim(p_new_group_name);
    v_group_slug := trim(both '-' from regexp_replace(lower(v_group_name), '[^a-z0-9]+', '-', 'g'));

    if v_group_slug = '' then
      raise exception 'New group name is not valid';
    end if;

    insert into public.guest_groups (name, slug, is_default, sort_order)
    values (v_group_name, v_group_slug, false, 999)
    on conflict (slug) do nothing
    returning id, slug, name
    into v_group_id, v_group_slug, v_group_name;

    if v_group_id is null then
      select id, slug, name
      into v_group_id, v_group_slug, v_group_name
      from public.guest_groups
      where slug = v_group_slug
      limit 1;
    end if;
  else
    select id, slug, name
    into v_group_id, v_group_slug, v_group_name
    from public.guest_groups
    where slug = coalesce(nullif(trim(p_group_slug), ''), 'default')
    limit 1;

    if v_group_id is null then
      select id, slug, name
      into v_group_id, v_group_slug, v_group_name
      from public.guest_groups
      where slug = 'default'
      limit 1;
    end if;
  end if;

  if v_group_id is null then
    raise exception 'No valid group found. Seed the default groups first.';
  end if;

  select exists (
    select 1
    from public.event_registrations as er
    where er.email = v_email
  )
  into v_registration_exists;

  insert into public.event_registrations (
    name,
    surname,
    full_name,
    email,
    guests_count,
    notes,
    group_id
  )
  values (
    trim(p_name),
    trim(p_surname),
    v_full_name,
    v_email,
    p_guests_count,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_group_id
  )
  on conflict (email) do update
  set
    name = excluded.name,
    surname = excluded.surname,
    full_name = excluded.full_name,
    guests_count = excluded.guests_count,
    notes = excluded.notes,
    group_id = excluded.group_id,
    updated_at = timezone('utc', now())
  returning id
  into v_registration_id;

  return query
  select
    v_registration_id,
    v_email,
    v_group_slug,
    v_group_name,
    case when v_registration_exists then 'updated' else 'created' end;
end;
$$;

drop function if exists public.save_music_profile(
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text[],
  text,
  text
);
create or replace function public.save_music_profile(
  p_name text,
  p_surname text,
  p_email text,
  p_instruments text[] default '{}'::text[],
  p_styles text[] default '{}'::text[],
  p_genres text[] default '{}'::text[],
  p_collaboration_modes text[] default '{}'::text[],
  p_availability_notes text default null,
  p_performance_notes text default null
)
returns table (
  registration_id uuid,
  music_profile_id uuid,
  full_name text,
  saved_mode text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_group_id uuid;
  v_email citext;
  v_full_name text;
  v_registration_id uuid;
  v_profile_id uuid;
  v_profile_exists boolean;
begin
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Name is required';
  end if;

  if nullif(trim(coalesce(p_surname, '')), '') is null then
    raise exception 'Surname is required';
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'Email is required';
  end if;

  if coalesce(cardinality(p_instruments), 0) = 0 then
    raise exception 'At least one instrument is required';
  end if;

  if coalesce(cardinality(p_styles), 0) = 0 then
    raise exception 'At least one style is required';
  end if;

  if coalesce(cardinality(p_genres), 0) = 0 then
    raise exception 'At least one genre is required';
  end if;

  select id
  into v_default_group_id
  from public.guest_groups
  where slug = 'default'
  limit 1;

  if v_default_group_id is null then
    raise exception 'Default guest group is missing. Seed the schema first.';
  end if;

  v_email := lower(trim(p_email))::citext;
  v_full_name := trim(concat_ws(' ', trim(p_name), trim(p_surname)));

  insert into public.event_registrations (
    name,
    surname,
    full_name,
    email,
    guests_count,
    notes,
    group_id
  )
  values (
    trim(p_name),
    trim(p_surname),
    v_full_name,
    v_email,
    1,
    null,
    v_default_group_id
  )
  on conflict (email) do update
  set
    name = excluded.name,
    surname = excluded.surname,
    full_name = excluded.full_name,
    updated_at = timezone('utc', now())
  returning id
  into v_registration_id;

  select exists (
    select 1
    from public.music_profiles as mp
    where mp.registration_id = v_registration_id
  )
  into v_profile_exists;

  insert into public.music_profiles (
    registration_id,
    instruments,
    styles,
    genres,
    collaboration_modes,
    availability_notes,
    performance_notes
  )
  values (
    v_registration_id,
    p_instruments,
    p_styles,
    p_genres,
    coalesce(p_collaboration_modes, '{}'::text[]),
    nullif(trim(coalesce(p_availability_notes, '')), ''),
    nullif(trim(coalesce(p_performance_notes, '')), '')
  )
  on conflict on constraint music_profiles_registration_id_key do update
  set
    instruments = excluded.instruments,
    styles = excluded.styles,
    genres = excluded.genres,
    collaboration_modes = excluded.collaboration_modes,
    availability_notes = excluded.availability_notes,
    performance_notes = excluded.performance_notes,
    updated_at = timezone('utc', now())
  returning id
  into v_profile_id;

  return query
  select
    v_registration_id,
    v_profile_id,
    v_full_name,
    case when v_profile_exists then 'updated' else 'created' end;
end;
$$;

drop function if exists public.list_music_profiles();
create or replace function public.list_music_profiles()
returns table (
  music_profile_id uuid,
  full_name text,
  instruments text[],
  styles text[],
  genres text[],
  collaboration_modes text[],
  availability_notes text,
  performance_notes text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    mp.id,
    er.full_name,
    mp.instruments,
    mp.styles,
    mp.genres,
    mp.collaboration_modes,
    mp.availability_notes,
    mp.performance_notes,
    mp.updated_at
  from public.music_profiles as mp
  join public.event_registrations as er
    on er.id = mp.registration_id
  order by er.full_name asc;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.guest_groups to anon, authenticated;
grant execute on function public.register_guest(text, text, text, integer, text, text, text)
  to anon, authenticated;
grant execute on function public.save_music_profile(
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text[],
  text,
  text
)
  to anon, authenticated;
grant execute on function public.list_music_profiles()
  to anon, authenticated;
