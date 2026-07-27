using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Attestation;

namespace OHPP.Services.Attestation;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers Attestation services: attestation processing, counter-signing,
    /// signature verification, and JWKS serving.
    /// </summary>
    public static IServiceCollection AddOhppAttestationServices(this IServiceCollection services)
    {
        services.AddScoped<IAttestationProcessingService, AttestationProcessingService>();
        services.AddScoped<ICounterSigningService, CounterSigningService>();
        services.AddScoped<ISignatureVerificationService, SignatureVerificationService>();
        services.AddScoped<IJwksService, JwksService>();

        return services;
    }
}
