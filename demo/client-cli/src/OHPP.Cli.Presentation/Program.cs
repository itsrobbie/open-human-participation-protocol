using OHPP.Cli.Domain;
using OHPP.Cli.Infrastructure;
using OHPP.Cli.Presentation;
using OHPP.Cli.Services;

var configStore = new FileConfigStore();
var keyPairGenerator = new Es256KeyPairGenerator();
var configService = new ConfigurationService(configStore, keyPairGenerator);
var attestationBuilder = new AttestationBuilder();
var challengeProcessor = new ChallengeProcessor();
var requestHandler = new CliRequestHandler(Console.In, Console.Out, attestationBuilder);

Console.WriteLine("┌─────────────────────────────────────┐");
Console.WriteLine("│    OHPP CLI Attester Simulator      │");
Console.WriteLine("│   Open Human Participation Protocol │");
Console.WriteLine("└─────────────────────────────────────┘");
Console.WriteLine();

var config = await configService.GetConfigAsync();

if (config is null)
{
    Console.WriteLine("This simulator acts as your approval device. It receives participation");
    Console.WriteLine("requests from apps (like the Bank) and lets you respond to them here.");
    Console.WriteLine();
    Console.WriteLine("━━━ FIRST-TIME SETUP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Console.WriteLine();
    Console.WriteLine("The CLI will sign in to the Resolver using your Portal credentials,");
    Console.WriteLine("register itself as a device, and start listening for requests.");
    Console.WriteLine();
    config = await RunSetup(configService);
}

// Verify the saved token is still valid before proceeding
var httpClient = new HttpClient();
var resolverClient = new HttpResolverClient(httpClient, config);

Console.WriteLine("Verifying device token...");
var tokenCheck = await resolverClient.GetPendingRequestsAsync();
if (tokenCheck is null)
{
    Console.WriteLine();
    Console.WriteLine("Your saved device token is no longer valid (401 Unauthorized).");
    Console.WriteLine("This happens when the database is reset but the CLI config persists.");
    Console.WriteLine();
    Console.WriteLine("Run 'make cli-reset' to clear your saved config, then 'make cli' again.");
    return;
}

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
    if (pending is null)
    {
        Console.WriteLine("Token rejected by Resolver. Run 'make cli-reset' and try again.");
        return;
    }
    if (pending.Count > 0)
    {
        Console.WriteLine($"{pending.Count} pending request(s) found.");
    }
    foreach (var request in pending)
    {
        await requestHandler.HandleAsync(request, config, resolverClient, cts.Token);
    }

    // Then listen via SSE for real-time delivery
    Console.WriteLine("Opening SSE connection...");
    var sseClient = new SseClient(new HttpClient(), config);
    await foreach (var request in sseClient.ConnectAsync(cts.Token))
    {
        await requestHandler.HandleAsync(request, config, resolverClient, cts.Token);
    }
    Console.WriteLine("SSE stream ended.");
}
catch (OperationCanceledException)
{
    Console.WriteLine();
    Console.WriteLine("Shutting down.");
}
catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Unauthorized)
{
    Console.WriteLine();
    Console.WriteLine("Device token rejected (401). Run 'make cli-reset' and try again.");
}
catch (Exception ex)
{
    Console.WriteLine($"Error: {ex.Message}");
}

// --- Helper methods ---

static async Task<CliConfig> RunSetup(ConfigurationService configService)
{
    const string resolverUrl = "http://resolver:8080";
    const string keycloakTokenUrl = "http://keycloak:8080/realms/ohpp/protocol/openid-connect/token";
    const string clientId = "ohpp-portal";

    Console.Write("Username (default: demo): ");
    var username = Console.ReadLine()?.Trim() ?? "";
    if (string.IsNullOrEmpty(username)) username = "demo";

    Console.Write("Password (default: demo): ");
    var password = Console.ReadLine()?.Trim() ?? "";
    if (string.IsNullOrEmpty(password)) password = "demo";

    Console.WriteLine();
    Console.WriteLine("Signing in...");

    // Authenticate with Keycloak to get an identity token
    using var http = new HttpClient();
    var tokenBody = new FormUrlEncodedContent(new Dictionary<string, string>
    {
        ["client_id"] = clientId,
        ["grant_type"] = "password",
        ["username"] = username,
        ["password"] = password,
    });
    var tokenResponse = await http.PostAsync(keycloakTokenUrl, tokenBody);
    if (!tokenResponse.IsSuccessStatusCode)
    {
        Console.WriteLine("Sign-in failed. Check your credentials and that the dev stack is running.");
        Environment.Exit(1);
    }
    var tokenJson = System.Text.Json.JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync());
    var accessToken = tokenJson.RootElement.GetProperty("access_token").GetString()!;

    // Create user profile in Resolver (idempotent)
    http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
    await http.PostAsync($"{resolverUrl}/api/users/me", null);

    // Register a CLI device
    Console.WriteLine("Registering CLI device...");
    var deviceBody = new System.Net.Http.StringContent(
        System.Text.Json.JsonSerializer.Serialize(new { name = "CLI Simulator", deviceType = "cli" }),
        System.Text.Encoding.UTF8, "application/json");
    var deviceResponse = await http.PostAsync($"{resolverUrl}/api/devices", deviceBody);
    if (!deviceResponse.IsSuccessStatusCode)
    {
        Console.WriteLine($"Could not register device: HTTP {(int)deviceResponse.StatusCode}");
        Environment.Exit(1);
    }
    var deviceJson = System.Text.Json.JsonDocument.Parse(await deviceResponse.Content.ReadAsStringAsync());
    var deviceToken = deviceJson.RootElement.GetProperty("deviceToken").GetString()!;

    var config = await configService.ConfigureAsync(deviceToken, resolverUrl);
    Console.WriteLine();
    Console.WriteLine("━━━ READY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Console.WriteLine($"  Signed in as: {username}");
    Console.WriteLine($"  Resolver:     {config.ResolverUrl}");
    Console.WriteLine($"  Device:       CLI Simulator (ES256 key pair generated)");
    Console.WriteLine();
    Console.WriteLine("Your config is saved. Next time you run 'make cli', it reconnects");
    Console.WriteLine("automatically. Run 'make cli-reset' to start fresh.");
    Console.WriteLine();
    return config;
}
