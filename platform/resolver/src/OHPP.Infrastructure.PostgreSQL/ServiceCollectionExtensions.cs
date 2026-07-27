using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Attestation;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Domain.Registration;
using OHPP.Infrastructure.PostgreSQL.Repositories;

namespace OHPP.Infrastructure.PostgreSQL;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the PostgreSQL DbContext and all repository implementations
    /// for Auth, Registration, Participation, and Attestation domains.
    /// </summary>
    public static IServiceCollection AddOhppPostgreSQL(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString));

        // Auth repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IDeviceTokenRepository, DeviceTokenRepository>();
        services.AddScoped<IAppAccessTokenRepository, AppAccessTokenRepository>();

        // Registration repositories
        services.AddScoped<IAppRegistrationRepository, AppRegistrationRepository>();
        services.AddScoped<IRegistrationChallengeStore, RegistrationChallengeStore>();

        // Participation repositories
        services.AddScoped<IPendingRequestRepository, PendingRequestRepository>();
        services.AddScoped<IParticipationRecordRepository, ParticipationRecordRepository>();

        // Attestation repositories
        services.AddScoped<IKeyStore, KeyStoreRepository>();

        return services;
    }
}
