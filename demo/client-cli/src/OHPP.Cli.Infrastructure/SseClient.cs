using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text.Json;
using OHPP.Cli.Domain;

namespace OHPP.Cli.Infrastructure;

/// <summary>
/// SSE client that connects to the Resolver's device event stream.
/// Yields incoming participation requests as they arrive.
/// </summary>
public sealed class SseClient : ISseClient
{
    private readonly HttpClient _httpClient;
    private readonly CliConfig _config;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public SseClient(HttpClient httpClient, CliConfig config)
    {
        _httpClient = httpClient;
        _config = config;
        _httpClient.BaseAddress = new Uri(config.ResolverUrl!);
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config.DeviceToken);
        _httpClient.Timeout = TimeSpan.FromHours(24); // SSE is long-lived
    }

    public async IAsyncEnumerable<IncomingRequest> ConnectAsync([EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/devices/me/events");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));

        var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        string? eventType = null;
        var dataBuilder = new System.Text.StringBuilder();

        while (!cancellationToken.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line is null)
                break; // Stream ended

            if (line.StartsWith("event:"))
            {
                eventType = line[6..].Trim();
            }
            else if (line.StartsWith("data:"))
            {
                dataBuilder.Append(line[5..].Trim());
            }
            else if (line == "") // Empty line = end of event
            {
                if ((eventType == "request" || eventType == "new_request") && dataBuilder.Length > 0)
                {
                    var incoming = TryParseRequest(dataBuilder.ToString());
                    if (incoming is not null)
                        yield return incoming;
                }

                eventType = null;
                dataBuilder.Clear();
            }
        }
    }

    private static IncomingRequest? TryParseRequest(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<IncomingRequest>(json, JsonOptions);
        }
        catch
        {
            return null;
        }
    }
}
