using System.Text;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;

namespace OHPP.Sdk;

/// <summary>
/// Generates registration challenges for the ohpp:// URI scheme.
/// Requesters create a challenge, encode it as a URI, and present it (QR code, link, etc.)
/// for a user's Client App to scan and begin the registration ceremony.
/// </summary>
public sealed class ChallengeGenerator
{
    private readonly OhppRequesterOptions _options;

    public ChallengeGenerator(OhppRequesterOptions options)
    {
        _options = options;
    }

    /// <summary>
    /// Creates a registration challenge with a unique ID and expiry.
    /// </summary>
    public RegistrationChallenge CreateChallenge(TimeSpan? validity = null)
    {
        var now = DateTimeOffset.UtcNow;
        var expiry = now.Add(validity ?? TimeSpan.FromMinutes(5));

        return new RegistrationChallenge
        {
            ChallengeId = Guid.NewGuid().ToString("N"),
            RequesterAppId = _options.AppId,
            ExpiresAt = expiry,
            CreatedAt = now
        };
    }

    /// <summary>
    /// Encodes a challenge as a base64url string suitable for use in a URI.
    /// </summary>
    public static string EncodeChallenge(RegistrationChallenge challenge)
    {
        var json = OhppJsonSerialiser.Serialise(challenge);
        var bytes = Encoding.UTF8.GetBytes(json);
        return Base64UrlEncode(bytes);
    }

    /// <summary>
    /// Decodes a base64url-encoded challenge string back into a RegistrationChallenge.
    /// Returns null if the payload is malformed.
    /// </summary>
    public static RegistrationChallenge? DecodeChallenge(string encoded)
    {
        try
        {
            var bytes = Base64UrlDecode(encoded);
            var json = Encoding.UTF8.GetString(bytes);
            return OhppJsonSerialiser.Deserialise<RegistrationChallenge>(json);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Builds the full ohpp:// URI for the given challenge.
    /// Format: ohpp://register?challenge={base64url}
    /// </summary>
    public static string BuildChallengeUri(RegistrationChallenge challenge)
    {
        var encoded = EncodeChallenge(challenge);
        return $"{ProtocolConstants.UriScheme}://{ProtocolConstants.RegisterAction}?{ProtocolConstants.ChallengeParam}={encoded}";
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static byte[] Base64UrlDecode(string encoded)
    {
        var base64 = encoded
            .Replace('-', '+')
            .Replace('_', '/');

        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }

        return Convert.FromBase64String(base64);
    }
}
