using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using OHPP.Domain.Auth;
using OHPP.Domain.Shared;

namespace OHPP.Infrastructure.Keycloak;

/// <summary>
/// Keycloak implementation of <see cref="IIdentityBroker"/>: the DEV identity
/// provider behind the Resolver's /api/auth endpoints. Creates users via the
/// Keycloak admin REST API and mints user tokens via the resource-owner-password
/// grant. The client never sees any of this — swap Auth:Provider to "Firebase"
/// (or another) in production and neither the app nor users change.
/// </summary>
public sealed class KeycloakIdentityBroker : IIdentityBroker
{
    private readonly KeycloakOptions _options;
    private readonly HttpClient _http;

    public KeycloakIdentityBroker(KeycloakOptions options, HttpClient http)
    {
        _options = options;
        _http = http;
    }

    private string ServerBaseUrl =>
        _options.ServerBaseUrl?.TrimEnd('/')
        // Derive from Authority (".../realms/<realm>") when not set explicitly.
        ?? _options.Authority[..Math.Max(0, _options.Authority.IndexOf("/realms", StringComparison.Ordinal))].TrimEnd('/');

    public async Task<Result<BrokeredAuth>> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return Error.Validation("Username and password are required.", []);
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return Error.Validation("A valid email is required.", []);

        var adminToken = await GetAdminTokenAsync(cancellationToken);
        if (adminToken is null)
            return Error.Unauthorized("The identity service is unavailable.");

        // Create the user (enabled, email set), then set a non-temporary password.
        var createReq = new HttpRequestMessage(
            HttpMethod.Post,
            $"{ServerBaseUrl}/admin/realms/{_options.Realm}/users")
        {
            Content = JsonContent.Create(new
            {
                username = request.Username,
                email = request.Email,
                firstName = request.FirstName,
                lastName = request.LastName,
                enabled = true,
                emailVerified = true,
                credentials = new[]
                {
                    new { type = "password", value = request.Password, temporary = false }
                }
            })
        };
        createReq.Headers.Authorization = new("Bearer", adminToken);

        HttpResponseMessage createResp;
        try
        {
            createResp = await _http.SendAsync(createReq, cancellationToken);
        }
        catch (HttpRequestException)
        {
            return Error.Unauthorized("The identity service is unavailable.");
        }

        if (createResp.StatusCode == HttpStatusCode.Conflict)
            return Error.Conflict("An account with that username or email already exists.");
        if (!createResp.IsSuccessStatusCode)
        {
            var body = await createResp.Content.ReadAsStringAsync(cancellationToken);
            return Error.Validation($"Registration was rejected ({(int)createResp.StatusCode}).",
                [new ValidationFailure { Field = "registration", Message = Truncate(body) }]);
        }

        // Account created — authenticate immediately so the caller gets tokens.
        return await AuthenticateAsync(new AuthenticateRequest(request.Username, request.Password), cancellationToken);
    }

    public async Task<Result<BrokeredAuth>> AuthenticateAsync(AuthenticateRequest request, CancellationToken cancellationToken = default)
    {
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = _options.TokenClientId,
            ["username"] = request.Username,
            ["password"] = request.Password,
            ["scope"] = "openid",
        });

        HttpResponseMessage resp;
        try
        {
            resp = await _http.PostAsync(
                $"{ServerBaseUrl}/realms/{_options.Realm}/protocol/openid-connect/token",
                form, cancellationToken);
        }
        catch (HttpRequestException)
        {
            return Error.Unauthorized("The identity service is unavailable.");
        }

        if (resp.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.BadRequest)
            return Error.Unauthorized("Invalid username or password.");
        if (!resp.IsSuccessStatusCode)
            return Error.Unauthorized("Authentication failed.");

        return await ParseTokenResponse(resp, request.Username, cancellationToken);
    }

    public async Task<Result<BrokeredAuth>> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
            return Error.Unauthorized("A refresh token is required.");

        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["client_id"] = _options.TokenClientId,
            ["refresh_token"] = refreshToken,
        });

        HttpResponseMessage resp;
        try
        {
            resp = await _http.PostAsync(
                $"{ServerBaseUrl}/realms/{_options.Realm}/protocol/openid-connect/token",
                form, cancellationToken);
        }
        catch (HttpRequestException)
        {
            return Error.Unauthorized("The identity service is unavailable.");
        }

        if (!resp.IsSuccessStatusCode)
            return Error.Unauthorized("The session has expired. Please sign in again.");

        return await ParseTokenResponse(resp, username: null, cancellationToken);
    }

    private static async Task<Result<BrokeredAuth>> ParseTokenResponse(
        HttpResponseMessage resp, string? username, CancellationToken ct)
    {
        var json = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var access = root.TryGetProperty("access_token", out var a) ? a.GetString() : null;
        if (string.IsNullOrEmpty(access))
            return Error.Unauthorized("Authentication failed.");
        var refresh = root.TryGetProperty("refresh_token", out var r) ? r.GetString() : null;
        var expires = root.TryGetProperty("expires_in", out var e) ? e.GetInt32() : 300;

        // Derive the user id from the token's 'sub' without a second round-trip.
        var userId = ReadSubClaim(access) ?? username ?? string.Empty;

        return new BrokeredAuth(access, refresh, expires, userId);
    }

    private async Task<string?> GetAdminTokenAsync(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.AdminUsername) || string.IsNullOrWhiteSpace(_options.AdminPassword))
            return null;

        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = _options.AdminClientId,
            ["username"] = _options.AdminUsername!,
            ["password"] = _options.AdminPassword!,
        });
        try
        {
            var resp = await _http.PostAsync(
                $"{ServerBaseUrl}/realms/{_options.AdminRealm}/protocol/openid-connect/token",
                form, ct);
            if (!resp.IsSuccessStatusCode) return null;
            var json = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("access_token", out var a) ? a.GetString() : null;
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    /// <summary>Read the 'sub' claim from a JWT without validating (the issuer just minted it).</summary>
    private static string? ReadSubClaim(string jwt)
    {
        try
        {
            var parts = jwt.Split('.');
            if (parts.Length < 2) return null;
            var payload = parts[1].Replace('-', '+').Replace('_', '/');
            payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
            using var doc = JsonDocument.Parse(Convert.FromBase64String(payload));
            return doc.RootElement.TryGetProperty("sub", out var sub) ? sub.GetString() : null;
        }
        catch
        {
            return null;
        }
    }

    private static string Truncate(string s) => s.Length <= 200 ? s : s[..200];
}
