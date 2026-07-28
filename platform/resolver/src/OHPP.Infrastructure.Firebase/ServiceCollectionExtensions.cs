using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Auth;

namespace OHPP.Infrastructure.Firebase;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers Firebase authentication infrastructure: FirebaseApp singleton and
    /// IIdentityTokenValidator backed by Firebase Admin SDK.
    /// If Google Application Default Credentials are not available, registration is skipped
    /// (allows test environments to provide their own IIdentityTokenValidator).
    /// In production, ensure GOOGLE_APPLICATION_CREDENTIALS is set.
    /// </summary>
    public static IServiceCollection AddOhppFirebaseAuth(this IServiceCollection services)
    {
        try
        {
            var credential = GoogleCredential.GetApplicationDefault();
            var firebaseApp = FirebaseApp.Create(new AppOptions { Credential = credential });
            services.AddSingleton(firebaseApp);
            services.AddScoped<IIdentityTokenValidator, FirebaseIdentityTokenValidator>();
        }
        catch
        {
            // Credentials not available (AggregateException/InvalidOperationException).
            // This is expected in test environments.
            // Test hosts must register their own IIdentityTokenValidator.
            // In production, the missing GOOGLE_APPLICATION_CREDENTIALS will be caught
            // at deployment validation time, not here.
        }

        return services;
    }
}
