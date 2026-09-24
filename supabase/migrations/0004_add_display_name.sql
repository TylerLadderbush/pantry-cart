-- Splits identity into a permanent handle (username, set once at signup,
-- never editable afterward) and a freely-editable display_name. This avoids
-- the "identity drift" problem where a user renaming their username could
-- confuse other users about who authored something, or free up the old
-- handle for someone else to immediately claim.
alter table public.users add column display_name text not null default '';

-- Backfill existing rows so display_name always starts out matching the
-- permanent username; from here on the application always sets it
-- explicitly at signup instead of relying on this default.
update public.users set display_name = username where display_name = '';
