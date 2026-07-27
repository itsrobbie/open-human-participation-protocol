using OHPP.Domain.Registration;
using OHPP.Domain.Shared;
using OHPP.Protocol.Models;

namespace OHPP.Services.Registration;

public class AppMetadataValidator : IAppMetadataValidator
{
    public Result<bool> Validate(RequesterAppMetadata metadata, string expectedAppId)
    {
        if (string.IsNullOrWhiteSpace(metadata.AppId))
            return Error.Validation("App metadata missing appId", Array.Empty<ValidationFailure>());

        if (metadata.AppId != expectedAppId)
            return Error.Validation($"AppId mismatch: expected '{expectedAppId}', got '{metadata.AppId}'", Array.Empty<ValidationFailure>());

        if (string.IsNullOrWhiteSpace(metadata.Name))
            return Error.Validation("App metadata missing name", Array.Empty<ValidationFailure>());

        if (string.IsNullOrWhiteSpace(metadata.Endpoints?.RegistrationCallback))
            return Error.Validation("App metadata missing endpoints.registrationCallback", Array.Empty<ValidationFailure>());

        return true;
    }
}
