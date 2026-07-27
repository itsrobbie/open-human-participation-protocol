using System.Security.Cryptography;
using OHPP.Domain.Shared;

namespace OHPP.Infrastructure.DotNet.Cryptography;

public sealed class CryptoTokenGenerator : ITokenGenerator
{
    private const int TokenBytes = 32;

    public string GenerateDeviceToken()
    {
        return TokenConstants.DeviceTokenPrefix + GenerateRandomBase64Url();
    }

    public string GenerateAppAccessToken()
    {
        return TokenConstants.AppTokenPrefix + GenerateRandomBase64Url();
    }

    private static string GenerateRandomBase64Url()
    {
        var bytes = RandomNumberGenerator.GetBytes(TokenBytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
