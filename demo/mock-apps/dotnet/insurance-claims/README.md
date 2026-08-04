# Insurance Claims Mock App

The Insurance Claims app is the second .NET OHPP requester mock app. It demonstrates a durable claims workflow backed by the shared World Postgres container.

## Run

From the repository root:

```bash
docker compose up --build
```

Open <http://localhost:5020>. The demo credentials are `demo` / `demo`.

## Storage and identity

- Keycloak realm: `ohpp-insurance`
- OIDC client: `ohpp-insurance-app`
- World Database schema: `insurance_claims`
- Database role: `insurance_claims_app`
- Shared Resolver correlation: `ohpp_user_id=demo-user`

The app owns its schema and cannot use the Bank schema. The Postgres container initializes the schema and idempotent policy seed. Test setup resets only the app-owned tables.

## Workflow

The UI supports sign-in, claim validation, submission, and reload persistence. The domain layer also maps all seven OHPP request types to app-defined claim scenarios: select, multiselect, text, number, date, datetime, and signature.

Focused tests:

```bash
make test-unit-insurance
make build-insurance
```
