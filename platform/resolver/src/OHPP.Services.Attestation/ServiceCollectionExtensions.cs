using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Attestation;

namespace OHPP.Services.Attestation;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers Attestation services: attestation processing,
    /// signature verification, and JWKS serving.
    /// Counter-signing is registered in Infrastructure.Protocol.Local
    /// because it depends on SDK protocol model types.
    /// </summary>
    public static IServiceCollection AddOhppAttestationServices(this IServiceCollection services)
    {
        services.AddScoped<IAttestationProcessingService, AttestationProcessingService>();
        services.AddScoped<ISignatureVerificationService, SignatureVerificationService>();
        services.AddScoped<IJwksService, JwksService>();

        return services;
    }
}
