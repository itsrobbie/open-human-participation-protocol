using FluentAssertions;
using FsCheck;
using FsCheck.Xunit;
using OHPP.Domain.Auth;
using OHPP.Protocol;
using OHPP.Services.Auth;

namespace OHPP.Tests.Unit.Auth;

public class TokenDiscriminationPropertyTests
{
    private readonly TokenDiscriminationService _sut = new();

    [Property]
    public bool PBT_TokenDiscrimination_AllValidJwts_ReturnIdentityType(NonEmptyString header, NonEmptyString payload, NonEmptyString sig)
    {
        var headerB64 = "eyJ" + Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes(header.Get)).TrimEnd('=');
        var payloadB64 = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes(payload.Get)).TrimEnd('=');
        var sigB64 = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes(sig.Get)).TrimEnd('=');
        var jwt = $"{headerB64}.{payloadB64}.{sigB64}";

        return _sut.DetermineTokenType(jwt) == TokenType.IdentityProvider;
    }

    [Property]
    public bool PBT_TokenDiscrimination_DevicePrefixedTokens_ReturnDeviceType(NonEmptyString suffix)
    {
        var token = ProtocolConstants.DeviceTokenPrefix + suffix.Get.Replace(".", "");
        return _sut.DetermineTokenType(token) == TokenType.Device;
    }

    [Property]
    public bool PBT_TokenDiscrimination_AppPrefixedTokens_ReturnAppAccessType(NonEmptyString suffix)
    {
        var token = ProtocolConstants.AppTokenPrefix + suffix.Get.Replace(".", "");
        return _sut.DetermineTokenType(token) == TokenType.AppAccess;
    }
}
