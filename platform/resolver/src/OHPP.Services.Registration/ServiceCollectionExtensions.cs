using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Registration;

namespace OHPP.Services.Registration;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers Registration services: challenge validation, metadata validation, and ceremony orchestration.
    /// </summary>
    public static IServiceCollection AddOhppRegistrationServices(this IServiceCollection services)
    {
        services.AddScoped<IChallengeValidator, ChallengeValidator>();
        services.AddScoped<IAppMetadataValidator, AppMetadataValidator>();
        services.AddScoped<IRegistrationCeremonyOrchestrator, RegistrationCeremonyOrchestrator>();

        return services;
    }
}
