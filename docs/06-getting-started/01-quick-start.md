# Quick start

## Run the demo

The fastest way to see OHPP in action is one command, with nothing else to install besides Docker:

```bash
make dev
```

This builds all images from source and starts the full ecosystem. First run takes a couple of minutes; subsequent runs are near-instant thanks to Docker layer caching.

This starts:

| Service | URL | What it is |
|---------|-----|------------|
| Resolver | http://localhost:5050 | OHPP Participation Service (routes requests, manages devices, issues attestations) |
| Portal | http://localhost:3000 | Management dashboard (register devices, view history, manage apps) |
| Bank | http://localhost:5010 | Demo bank with Overview, Payments, Payees, Transactions, and Settings |
| Insurance Claims | http://localhost:5020 | Demo claims app with OHPP claim decisions |
| CLI | `make cli` | Development attester simulator for terminal approvals |
| PostgreSQL | localhost:5432 | The single World database for the platform and demo app schemas |

`postgres` is the only database container. New volumes are initialized by the PostgreSQL entrypoint, and `make dev` runs the same idempotent World database SQL inside that container before starting the applications. The old one-shot `world-database-init` service is no longer needed.

### What to try

1. Open the Bank at http://localhost:5010 and sign in with `demo` / `demo`. Make a payment. It completes immediately without OHPP.
2. Open the Resolver's Swagger UI at http://localhost:5050/swagger and explore the API.
3. Register a user and device via the Portal at http://localhost:3000.
4. Connect the Bank to OHPP from its Settings page.
5. Make another payment. This time it waits for your approval.
6. For terminal testing, run `make cli` and follow the setup and response prompts. This is a development simulator, not the planned mobile Client App.
7. In a development stack, open Protocol Lab from Portal to create, resolve, and inspect all seven request types in the browser. The Lab is disabled by default in unconfigured and production builds.

---

## What's in this repository

| Directory | What it contains |
|-----------|-----------------|
| `/docs/` | Protocol specification (problem, concepts, formal spec, use cases) |
| `/platform/resolver/` | OHPP Resolver — the reference Participation Service (.NET 8) |
| `/platform/portal/` | Management dashboard (React + TypeScript) |
| `/sdks/dotnet/` | .NET SDKs (OHPP.Protocol, OHPP.Sdk, OHPP.Sdk.Server) |
| `/demo/client-cli/` | Development CLI attester simulator (.NET 8) |
| `/demo/mock-apps/dotnet/bank/` | Demo bank app with OHPP-enabled payments (.NET 8) |
| `/demo/mock-apps/dotnet/insurance-claims/` | Demo insurance claims app with OHPP decisions (.NET 8) |
| `/docker-compose.yml` | One-command demo orchestration |

---

## Reading the protocol spec

If you're evaluating OHPP as a protocol (not the implementation):

| If you want to... | Read |
|-------------------|------|
| Understand the problem | [01 - The problem](../01-the-problem/01-human-participation-problem.md) |
| Understand the approach | [02 - Concepts](../02-concepts/01-participation-vs-intent.md) |
| See how it works at a high level | [03 - The protocol](../03-the-protocol/01-overview.md) |
| Read the formal specification | [04 - Specification](../04-specification/01-message-schemas.md) |
| See industry-specific scenarios | [05 - Use cases](../05-use-cases/01-financial-services.md) |

---

## Integrating OHPP into your app

The .NET SDK makes integration straightforward:

```csharp
// In your Program.cs
builder.Services.AddOhppRequester(options =>
{
    options.AppId = "your-app.example.com";
    options.AppName = "Your App";
    options.CallbackPath = "/ohpp/callback";
    options.BaseUrl = "https://your-app.example.com";
});
```

Then send a participation request:

```csharp
var request = new ParticipationRequestBuilder()
    .ForUser(userId)
    .FromApp("your-app.example.com")
    .WithSummary("Approve £500 transfer to John")
    .OfType(RequestType.Select)
    .AddOption("approve", "Approve")
    .AddOption("deny", "Deny")
    .ExpiresIn(TimeSpan.FromMinutes(5))
    .Build();

var result = await requesterClient.SendRequestAsync(request, resolverUrl, accessToken);
```

See [Integrate as a Requester](02-integrate-requester.md) for the full guide.

---

## Building a Resolver

If you want to run your own Participation Service:

```csharp
builder.Services.AddOhppResolver<MyResolverServices, MyAuthAccessor>(options =>
{
    options.BaseUrl = "https://resolver.example.com";
    options.Name = "My Resolver";
});

app.UseOhppResolver();
```

The SDK handles all protocol endpoints (metadata, JWKS, participate, status, cancel). You implement `IOhppResolverServices` to wire in your own storage and business logic.

See [Run a Resolver](03-run-resolver.md) for details.

---

## Next

- [Integrate as a Requester →](02-integrate-requester.md)
- [Run a Resolver →](03-run-resolver.md)
- [FAQ →](04-faq.md)
