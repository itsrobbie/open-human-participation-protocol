using OHPP.Domain.Auth;
using OHPP.Protocol;

namespace OHPP.Services.Auth;

public class TokenDiscriminationService : ITokenDiscriminationService
{
    public TokenType DetermineTokenType(string? token)
    {
        if (string.IsNullOrEmpty(token))
            return TokenType.Unknown;

        if (token.StartsWith(ProtocolConstants.DeviceTokenPrefix))
            return TokenType.Device;

        if (token.StartsWith(ProtocolConstants.AppTokenPrefix))
            return TokenType.AppAccess;

        if (IsJwtFormat(token))
            return TokenType.IdentityProvider;

        return TokenType.Unknown;
    }

    private static bool IsJwtFormat(string token)
    {
        var parts = token.Split('.');
        return parts.Length == 3 && token.StartsWith("eyJ");
    }
}
