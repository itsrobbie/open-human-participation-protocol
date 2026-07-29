# OHPP .NET SDKs

Three packages for integrating with the Open Human Participation Protocol:

| Package | Purpose | NuGet |
|---------|---------|-------|
| **OHPP.Protocol** | Shared protocol models, serialisation, validation | — |
| **OHPP.Sdk** | Requester SDK — for apps that want to request human participation | — |
| **OHPP.Sdk.Server** | Resolver SDK — for building OHPP Participation Services | — |

## OHPP.Sdk (Requester)

For any application that wants to request human participation before completing an action.

### Installation

Reference `OHPP.Sdk` in your project. Register in DI:

```csharp
builder.Services.AddOhppRequester(options =>
{
    options.AppId = "your-app.example.com";
    options.AppName = "Your Application";
    options.CallbackPath = "/ohpp/callback";
    options.BaseUrl = "https://your-app.example.com";
});
```

### Usage

```csharp
// Build a participation request
var request = new ParticipationRequestBuilder()
    .ForUser(userId)
    .FromApp("your-app.example.com")
    .WithSummary("Approve £500 transfer")
    .WithDescription("Transfer **£500** to **John Smith**")
    .OfType(RequestType.Select)
    .AddOption("approve", "Approve")
    .AddOption("deny", "Deny")
    .ExpiresIn(TimeSpan.FromMinutes(5))
    .Build();

// Send to the Resolver
var result = await requesterClient.SendRequestAsync(request, resolverUrl, accessToken);

// Poll for the user's decision
var status = await requesterClient.GetStatusAsync(result.RequestId, resolverUrl, accessToken);
```

### Key classes
- `IOhppRequesterClient` — send requests, poll status, cancel, verify attestations
- `ParticipationRequestBuilder` — fluent builder for protocol-compliant requests
- `ChallengeGenerator` — create registration challenge URIs (`ohpp://register?challenge=...`)
- `CallbackHandler` — handle inbound registration callbacks
- `EndpointDiscovery` — cached Resolver metadata lookup

## OHPP.Sdk.Server (Resolver)

For anyone building their own OHPP Participation Service (Resolver).

### Installation

Reference `OHPP.Sdk.Server`. Register in DI:

```csharp
builder.Services.AddOhppResolver<MyResolverServices, MyAuthAccessor>(options =>
{
    options.BaseUrl = "https://resolver.example.com";
    options.Name = "My Resolver";
});

app.UseOhppResolver();
```

### What you implement

| Interface | Purpose |
|-----------|---------|
| `IOhppResolverServices` | Your business logic — store requests, manage keys, return status |
| `IOhppAuthContextAccessor` | Bridge your auth middleware to the SDK's auth model |

The SDK handles: routing, payload validation, serialisation, metadata serving, JWKS format.

## OHPP.Protocol (Shared)

Used by both SDKs. Contains:
- Protocol DTOs (`ParticipationRequest`, `AttestationEnvelope`, `RegistrationChallenge`, etc.)
- Enums (`RequestType`, `RequestStatus`, `ResolutionMethod`, `SignatureAlgorithm`)
- Constants (max lengths, well-known paths, token prefixes)
- `OhppJsonSerialiser` — canonical JSON serialisation for signing
- `ParticipationRequestValidator` — schema validation

## Tests

```bash
dotnet test sdks/dotnet/OhppSdk.sln
```

65 tests across Protocol, Sdk, and Sdk.Server test projects.
