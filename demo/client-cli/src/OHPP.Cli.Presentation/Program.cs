using OHPP.Cli.Domain;
using OHPP.Cli.Infrastructure;
using OHPP.Cli.Services;

var configStore = new FileConfigStore();
var keyPairGenerator = new Es256KeyPairGenerator();
var configService = new ConfigurationService(configStore, keyPairGenerator);
var attestationBuilder = new AttestationBuilder();
var challengeProcessor = new ChallengeProcessor();

Console.WriteLine("┌─────────────────────────────────────┐");
Console.WriteLine("│       OHPP CLI Client v1.0          │");
Console.WriteLine("│   Open Human Participation Protocol │");
Console.WriteLine("└─────────────────────────────────────┘");
Console.WriteLine();

var config = await configService.GetConfigAsync();

if (config is null)
{
    Console.WriteLine("Not configured. Run with --configure flag or enter setup now.");
    Console.WriteLine();
    config = await RunSetup(configService);
}

// Register public key if needed
var httpClient = new HttpClient();
var resolverClient = new HttpResolverClient(httpClient, config);

if (config.HasKeyPair)
{
    Console.WriteLine("Registering device key with Resolver...");
    var registered = await resolverClient.RegisterPublicKeyAsync(config.PublicKeyPem!, "ES256");
    Console.WriteLine(registered ? "Key registered." : "Key registration skipped (may already exist).");
    Console.WriteLine();
}

// Main loop: fetch pending and listen
Console.WriteLine($"Connected to: {config.ResolverUrl}");
Console.WriteLine("Listening for participation requests... (Ctrl+C to quit)");
Console.WriteLine(new string('─', 50));
Console.WriteLine();

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

try
{
    // First fetch any existing pending requests
    var pending = await resolverClient.GetPendingRequestsAsync(cts.Token);
    foreach (var request in pending)
    {
        await HandleRequest(request, config, attestationBuilder, resolverClient, cts.Token);
    }

    // Then listen via SSE
    var sseClient = new SseClient(new HttpClient(), config);
    await foreach (var request in sseClient.ConnectAsync(cts.Token))
    {
        await HandleRequest(request, config, attestationBuilder, resolverClient, cts.Token);
    }
}
catch (OperationCanceledException)
{
    Console.WriteLine();
    Console.WriteLine("Shutting down.");
}

// --- Helper methods ---

static async Task<CliConfig> RunSetup(ConfigurationService configService)
{
    Console.Write("Device token: ");
    var token = Console.ReadLine()?.Trim() ?? "";

    Console.Write("Resolver URL: ");
    var url = Console.ReadLine()?.Trim() ?? "";

    var config = await configService.ConfigureAsync(token, url);
    Console.WriteLine();
    Console.WriteLine($"Configured. Key pair generated.");
    Console.WriteLine($"  Resolver: {config.ResolverUrl}");
    Console.WriteLine();
    return config;
}

static async Task HandleRequest(
    IncomingRequest request,
    CliConfig config,
    AttestationBuilder attestationBuilder,
    HttpResolverClient resolverClient,
    CancellationToken cancellationToken)
{
    Console.WriteLine($"┌── Request from: {request.AppId}");
    Console.WriteLine($"│   {request.Summary}");

    if (request.Description is not null)
        Console.WriteLine($"│   {request.Description}");

    if (request.Rationale is not null)
        Console.WriteLine($"│   Reason: {request.Rationale}");

    if (request.Expiry.HasValue)
        Console.WriteLine($"│   Expires: {request.Expiry.Value:g}");

    string decision;

    if (request.Options is { Count: > 0 })
    {
        Console.WriteLine("│");
        for (var i = 0; i < request.Options.Count; i++)
        {
            Console.WriteLine($"│   [{i + 1}] {request.Options[i].Label}");
        }
        Console.WriteLine("│");
        Console.Write("└── Your choice (number): ");

        var input = Console.ReadLine()?.Trim() ?? "";
        if (int.TryParse(input, out var choice) && choice >= 1 && choice <= request.Options.Count)
        {
            decision = request.Options[choice - 1].Key;
        }
        else
        {
            Console.WriteLine("    Invalid choice. Skipping.");
            Console.WriteLine();
            return;
        }
    }
    else
    {
        Console.Write("└── Your response: ");
        decision = Console.ReadLine()?.Trim() ?? "";
        if (string.IsNullOrEmpty(decision))
        {
            Console.WriteLine("    Empty response. Skipping.");
            Console.WriteLine();
            return;
        }
    }

    // Sign and submit
    var payload = attestationBuilder.BuildPayload(request.RequestId, decision, request.Type);
    var signature = attestationBuilder.Sign(payload, config.PrivateKeyPem!);
    var success = await resolverClient.SubmitAttestationAsync(request.RequestId, payload, signature, cancellationToken);

    Console.WriteLine(success ? "    ✓ Attestation submitted." : "    ✗ Submission failed.");
    Console.WriteLine();
}
