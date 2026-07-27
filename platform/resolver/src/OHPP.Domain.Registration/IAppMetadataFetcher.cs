using OHPP.Domain.Registration.Models;

namespace OHPP.Domain.Registration;

public interface IAppMetadataFetcher
{
    Task<AppMetadataData?> FetchAsync(string appId, CancellationToken cancellationToken = default);
}
