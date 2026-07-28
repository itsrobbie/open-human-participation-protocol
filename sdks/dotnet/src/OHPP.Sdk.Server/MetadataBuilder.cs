using OHPP.Protocol.Models;

namespace OHPP.Sdk.Server;

/// <summary>
/// Builds the ServiceMetadata response from OhppResolverOptions.
/// </summary>
public static class MetadataBuilder
{
    public static ServiceMetadata Build(OhppResolverOptions options)
    {
        var baseUrl = options.BaseUrl.TrimEnd('/');

        return new ServiceMetadata
        {
            Name = options.Name,
            ProtocolVersion = new ProtocolVersionRange
            {
                Min = options.ProtocolVersionMin,
                Max = options.ProtocolVersionMax
            },
            Endpoints = new ServiceEndpoints
            {
                Participate = $"{baseUrl}{options.ParticipatePath}",
                ParticipateStatus = $"{baseUrl}{options.StatusPathTemplate}",
                Keys = $"{baseUrl}{options.JwksPath}",
                Federation = options.FederationEndpoint
            }
        };
    }
}
