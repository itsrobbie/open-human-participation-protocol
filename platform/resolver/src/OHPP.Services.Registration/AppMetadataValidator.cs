using OHPP.Domain.Registration;
using OHPP.Domain.Registration.Models;
using OHPP.Domain.Shared;

namespace OHPP.Services.Registration;

public class AppMetadataValidator : IAppMetadataValidator
{
    public Result<bool> Validate(AppMetadataData metadata, string expectedAppId)
    {
        if (string.IsNullOrWhiteSpace(metadata.AppId))
            return Error.Validation("App metadata missing appId", Array.Empty<ValidationFailure>());

        if (metadata.AppId != expectedAppId)
            return Error.Validation($"AppId mismatch: expected '{expectedAppId}', got '{metadata.AppId}'", Array.Empty<ValidationFailure>());

        if (string.IsNullOrWhiteSpace(metadata.Name))
            return Error.Validation("App metadata missing name", Array.Empty<ValidationFailure>());

        if (string.IsNullOrWhiteSpace(metadata.RegistrationCallbackPath))
            return Error.Validation("App metadata missing registrationCallbackPath", Array.Empty<ValidationFailure>());

        return true;
    }
}
