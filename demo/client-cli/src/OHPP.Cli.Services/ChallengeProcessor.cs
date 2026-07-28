using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Sdk;

namespace OHPP.Cli.Services;

/// <summary>
/// Processes ohpp:// registration challenge URIs.
/// Validates format, decodes the challenge, checks expiry.
/// </summary>
public sealed class ChallengeProcessor
{
    /// <summary>
    /// Parses and validates an ohpp:// URI.
    /// Returns the decoded challenge on success, or an error message on failure.
    /// </summary>
    public ChallengeResult Process(string uri, DateTimeOffset? currentTime = null)
    {
        var now = currentTime ?? DateTimeOffset.UtcNow;

        if (string.IsNullOrWhiteSpace(uri))
            return ChallengeResult.Fail("URI is empty");

        // Expected format: ohpp://register?challenge={base64url}
        if (!uri.StartsWith($"{ProtocolConstants.UriScheme}://", StringComparison.OrdinalIgnoreCase))
            return ChallengeResult.Fail($"URI must start with {ProtocolConstants.UriScheme}://");

        var queryStart = uri.IndexOf('?');
        if (queryStart < 0)
            return ChallengeResult.Fail("URI missing query parameters");

        var path = uri[($"{ProtocolConstants.UriScheme}://".Length)..queryStart];
        if (!string.Equals(path, ProtocolConstants.RegisterAction, StringComparison.OrdinalIgnoreCase))
            return ChallengeResult.Fail($"URI path must be '{ProtocolConstants.RegisterAction}'");

        var query = uri[(queryStart + 1)..];
        var challengeParam = $"{ProtocolConstants.ChallengeParam}=";
        if (!query.StartsWith(challengeParam, StringComparison.OrdinalIgnoreCase))
            return ChallengeResult.Fail($"URI must contain '{ProtocolConstants.ChallengeParam}' parameter");

        var encoded = query[challengeParam.Length..];
        if (string.IsNullOrWhiteSpace(encoded))
            return ChallengeResult.Fail("Challenge parameter is empty");

        var challenge = ChallengeGenerator.DecodeChallenge(encoded);
        if (challenge is null)
            return ChallengeResult.Fail("Could not decode challenge payload");

        if (challenge.ExpiresAt <= now)
            return ChallengeResult.Fail("Challenge has expired");

        return ChallengeResult.Ok(challenge);
    }
}

public sealed class ChallengeResult
{
    public bool Success { get; init; }
    public RegistrationChallenge? Challenge { get; init; }
    public string? Error { get; init; }

    public static ChallengeResult Ok(RegistrationChallenge challenge) => new()
    {
        Success = true,
        Challenge = challenge
    };

    public static ChallengeResult Fail(string error) => new()
    {
        Success = false,
        Error = error
    };
}
