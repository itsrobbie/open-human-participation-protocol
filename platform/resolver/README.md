# OHPP Resolver

The reference implementation of an OHPP Participation Service (Resolver). Routes participation requests from Requester apps to users' devices, manages attestation signing, and serves the protocol endpoints.

## Architecture

Onion architecture with clean separation:

```
Presentation.Api → Services → Domain ← Infrastructure
                                     ← Infrastructure.PostgreSQL
                                     ← Infrastructure.Firebase
                                     ← Infrastructure.DotNet
```

Uses the **OHPP.Sdk.Server** for protocol endpoints (metadata, JWKS, participate, status, cancel).

## Running locally

### Prerequisites
- .NET 8 SDK
- PostgreSQL (or use Docker)
- Docker (for integration tests)

### Quick start

```bash
# Start PostgreSQL
docker run -d --name ohpp-postgres -e POSTGRES_USER=ohpp -e POSTGRES_PASSWORD=ohpp -e POSTGRES_DB=ohpp -p 5432:5432 postgres:16-alpine

# Run the Resolver
cd platform/resolver
dotnet run --project src/OHPP.Presentation.Api
```

The API runs at http://localhost:5000 with Swagger UI at http://localhost:5000/swagger.

### Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ConnectionStrings__PostgreSQL` | PostgreSQL connection string | Required |
| `Resolver__BaseUrl` | Public URL of this Resolver | `http://localhost:5000` |
| `Resolver__Name` | Display name | `OHPP Resolver` |
| `Resolver__EncryptionKey` | AES key for private key encryption (min 32 chars) | Required |

## Tests

```bash
# Unit tests (no Docker required)
dotnet test --filter "Category!=RequiresDocker"

# Full integration tests (requires Docker for TestContainers)
dotnet test
```

111 integration tests + 206 unit tests cover the full protocol flow.

## API endpoints

### Protocol (via SDK Server)
- `GET /.well-known/ohpp/metadata` — service discovery
- `GET /.well-known/ohpp/keys` — JWKS for attestation verification
- `POST /api/participate` — submit participation request
- `GET /api/participate/{id}/status` — poll request status
- `POST /api/participate/{id}/cancel` — cancel request

### Portal (user management)
- `POST /api/users/me` — create/get user profile
- `GET /api/users/me/summary` — dashboard stats
- `GET /api/history` — participation history
- `GET/POST /api/devices` — device management
- `GET/DELETE /api/registrations/apps` — registered app management

### Device (client operations)
- `POST /api/devices/me/keys` — register public key
- `GET /api/devices/me/events` — SSE stream for real-time requests
- `GET /api/devices/me/pending` — fetch pending requests
- `POST /api/devices/me/attestations` — submit signed attestation
