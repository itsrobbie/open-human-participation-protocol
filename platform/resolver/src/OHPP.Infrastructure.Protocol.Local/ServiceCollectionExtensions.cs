using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.Protocol.Local;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the local protocol validation infrastructure (request deserialisation and validation).
    /// </summary>
    public static IServiceCollection AddOhppProtocolValidation(this IServiceCollection services)
    {
        services.AddSingleton<IRequestValidator, ProtocolRequestValidator>();

        return services;
    }
}
