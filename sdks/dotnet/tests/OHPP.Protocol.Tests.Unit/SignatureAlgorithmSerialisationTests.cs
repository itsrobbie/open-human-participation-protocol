using FluentAssertions;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using Xunit;

namespace OHPP.Protocol.Tests.Unit;

public sealed class SignatureAlgorithmSerialisationTests
{
    [Theory]
    [InlineData(SignatureAlgorithm.ES256, "ES256")]
    [InlineData(SignatureAlgorithm.EdDSA, "EdDSA")]
    public void SignatureAlgorithm_Serialise_UsesProtocolSpelling(SignatureAlgorithm algorithm, string expected)
    {
        var signature = new SignatureInfo { Algorithm = algorithm, Value = "value", KeyId = "key" };

        var json = OhppJsonSerialiser.Serialise(signature);

        json.Should().Contain($"\"algorithm\":\"{expected}\"");
    }
}
