-- Truncate all application tables, preserving schema and EF migrations history
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != '__EFMigrationsHistory'
  LOOP
    EXECUTE 'TRUNCATE TABLE "' || tbl || '" CASCADE';
  END LOOP;
END $$;
