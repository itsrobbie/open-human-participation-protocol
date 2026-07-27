using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Participation;

namespace OHPP.Services.Participation;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers Participation services: request submission, lifecycle management,
    /// expiry enforcement, and notification fan-out.
    /// </summary>
    public static IServiceCollection AddOhppParticipationServices(this IServiceCollection services)
    {
        services.AddScoped<IParticipationRequestService, ParticipationRequestService>();
        services.AddScoped<IRequestLifecycleManager, RequestLifecycleManager>();
        services.AddScoped<IExpiryEnforcementService, ExpiryEnforcementService>();
        services.AddScoped<INotificationService, NotificationService>();

        return services;
    }
}
