using OHPP.Domain.Registration.Models;
using OHPP.Domain.Shared;

namespace OHPP.Domain.Registration;

public interface IAppMetadataValidator
{
    Result<bool> Validate(AppMetadataData metadata, string expectedAppId);
}
