-- Tables created via raw SQL (rather than the dashboard Table Editor) don't
-- automatically receive privilege grants. RLS-bypass and table-level GRANTs
-- are separate layers: service_role can bypass RLS but still needs explicit
-- privileges to touch the table at all.
grant select, insert, update, delete on public.users to service_role;
