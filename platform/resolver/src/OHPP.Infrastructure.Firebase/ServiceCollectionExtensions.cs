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
    /// </summary>
    public static IServiceCollection AddOhppFirebaseAuth(this IServiceCollection services)
    {
        var firebaseApp = FirebaseApp.Create(new AppOptions
        {
            Credential = GoogleCredential.GetApplicationDefault()
        });

        services.AddSingleton(firebaseApp);
        services.AddScoped<IIdentityTokenValidator, FirebaseIdentityTokenValidator>();

        return services;
    }
}
