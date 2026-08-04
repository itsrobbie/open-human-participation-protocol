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

-- The mock apps own isolated schemas in the shared World database.
TRUNCATE TABLE insurance_claims.claims, insurance_claims.registrations, insurance_claims.pending_challenges RESTART IDENTITY CASCADE;
TRUNCATE TABLE bank.transactions, bank.registrations, bank.pending_challenges RESTART IDENTITY CASCADE;
DELETE FROM bank.accounts WHERE id NOT IN ('demo-account', 'demo-current');
UPDATE bank.accounts
SET owner_user_id = 'demo-user',
    name = 'Demo Savings Account',
    balance = 5000.00,
    payees = '[{"id":"payee-landlord","name":"Landlord - J. Smith","accountNumber":"40205678","sortCode":"20-30-40"},{"id":"payee-electric","name":"Electric Co.","accountNumber":"11223344","sortCode":"10-20-30"},{"id":"payee-friend","name":"Alex (friend)","accountNumber":"87654321","sortCode":"40-50-60"}]'::jsonb,
    resolver_url = NULL,
    access_token = NULL,
    user_id = NULL
WHERE id = 'demo-account';

INSERT INTO bank.accounts (id, owner_user_id, name, balance, payees, resolver_url, access_token, user_id)
VALUES (
  'demo-current',
  'demo-user',
  'Demo Current Account',
  1250.00,
  '[{"id":"payee-landlord","name":"Landlord - J. Smith","accountNumber":"40205678","sortCode":"20-30-40"},{"id":"payee-electric","name":"Electric Co.","accountNumber":"11223344","sortCode":"10-20-30"}]'::jsonb,
  NULL,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  owner_user_id = EXCLUDED.owner_user_id,
  name = EXCLUDED.name,
  balance = EXCLUDED.balance,
  payees = EXCLUDED.payees,
  resolver_url = NULL,
  access_token = NULL,
  user_id = NULL;
