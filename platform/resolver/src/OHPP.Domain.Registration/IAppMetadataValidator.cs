using OHPP.Domain.Shared;
using OHPP.Protocol.Models;

namespace OHPP.Domain.Registration;

public interface IAppMetadataValidator
{
    Result<bool> Validate(RequesterAppMetadata metadata, string expectedAppId);
}
