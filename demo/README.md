# OHPP Demo

Demonstrates the Open Human Participation Protocol end-to-end.

## Running the demo

From the repository root:

```bash
docker compose up
```

### Services

| Service | Port | URL |
|---------|------|-----|
| Resolver | 5050 | http://localhost:5050 |
| Portal | 3000 | http://localhost:3000 |
| Bank | 5010 | http://localhost:5010 |
| PostgreSQL | 5432 | — |
| CLI | — | `docker compose exec -it cli sh` |

### Walk-through

#### 1. Transfer without OHPP
1. Open http://localhost:5010
2. Select a payee, enter an amount, click "Send Transfer"
3. Transfer completes immediately — no human check

#### 2. Connect OHPP
1. Open http://localhost:5050/swagger — use the Portal endpoints to create a user and device
2. Note down the device token
3. In the Bank UI (http://localhost:5010), go to "OHPP Settings"
4. Enter the Resolver URL (`http://resolver:8080` inside Docker, or `http://localhost:5050` from your machine) and the access token from app registration
5. Click "Connect OHPP"

#### 3. Transfer with OHPP
1. Make another transfer in the Bank
2. The UI shows "Waiting for approval on your device..."
3. Approve via the CLI: `docker compose exec -it cli sh`
4. The transfer completes after approval

#### 4. View history
- Open the Portal at http://localhost:3000
- Go to "History" to see the participation record

## Demo components

### CLI Client (`demo/client-cli/`)
Interactive terminal app that:
- Connects to the Resolver via device token
- Receives participation requests via SSE
- Displays requests with options
- Signs attestations with ES256

### Bank App (`demo/mock-apps/dotnet/bank/`)
OHPP-enabled banking demo that:
- Uses the OHPP.Sdk Requester SDK
- Sends participation requests before transfers (when connected)
- Shows the before/after OHPP difference
- Serves `/.well-known/ohpp/app-metadata` for registration

## Stopping

```bash
docker compose down -v  # -v removes volumes (database data)
```
