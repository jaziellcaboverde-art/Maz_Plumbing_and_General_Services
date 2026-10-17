-- Step 2.2: enable PostGIS.
-- Supabase installs extensions in the "extensions" schema. Later migrations must write
-- PostGIS types and functions with that prefix, for example extensions.geography and
-- extensions.st_distance. Point order is longitude first, then latitude.
create extension if not exists postgis with schema extensions;
