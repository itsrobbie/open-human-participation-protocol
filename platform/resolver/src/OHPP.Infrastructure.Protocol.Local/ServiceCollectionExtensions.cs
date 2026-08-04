using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Attestation;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.Protocol.Local;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the local protocol infrastructure: request deserialisation, validation,
    /// and counter-signing (which depends on OHPP.Protocol model types).
    /// </summary>
    public static IServiceCollection AddOhppProtocolValidation(this IServiceCollection services)
    {
        services.AddSingleton<IRequestValidator, ProtocolRequestValidator>();
        services.AddSingleton<IRequestDeserialiser, ProtocolRequestDeserialiser>();
        services.AddScoped<ICounterSigningService, CounterSigningService>();

        return services;
    }
}
