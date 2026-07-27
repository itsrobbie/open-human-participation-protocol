using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Auth;

namespace OHPP.Services.Auth;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers Auth services: token discrimination, authentication resolution, and user profile management.
    /// </summary>
    public static IServiceCollection AddOhppAuthServices(this IServiceCollection services)
    {
        services.AddScoped<ITokenDiscriminationService, TokenDiscriminationService>();
        services.AddScoped<IAuthenticationService, AuthenticationService>();
        services.AddScoped<IUserProfileService, UserProfileService>();

        return services;
    }
}
