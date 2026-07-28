using FsCheck;
using FsCheck.Xunit;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;

namespace OHPP.Sdk.Server.Tests.Unit;

public sealed class PropertyTests
{
    [Property]
    public bool PBT_MetadataSerialisation_RoundTrip(byte variant)
    {
        var options = new OhppResolverOptions
        {
            BaseUrl = "https://resolver.test",
            Name = $"Resolver-{variant}"
        };

        var metadata = MetadataBuilder.Build(options);
        var json = OhppJsonSerialiser.Serialise(metadata);
        var roundTripped = OhppJsonSerialiser.Deserialise<ServiceMetadata>(json);

        return roundTripped is not null
            && roundTripped.Name == metadata.Name
            && roundTripped.Endpoints.Participate == metadata.Endpoints.Participate
            && roundTripped.Endpoints.Keys == metadata.Endpoints.Keys;
    }
}
