using OHPP.Protocol.Models;

namespace OHPP.Domain.Registration;

public interface IAppMetadataFetcher
{
    Task<RequesterAppMetadata?> FetchAsync(string appId, CancellationToken cancellationToken = default);
}
