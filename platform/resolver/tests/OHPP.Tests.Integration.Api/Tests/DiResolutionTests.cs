using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Attestation;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Domain.Registration;
using OHPP.Domain.Shared;
using OHPP.Infrastructure.DotNet.Http;
using OHPP.Infrastructure.DotNet.Notifications;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

/// <summary>
/// Smoke tests that verify all critical services resolve from the DI container.
/// Catches misconfigured ServiceCollectionExtensions without needing to hit every endpoint.
/// </summary>
[Trait("Category", "RequiresDocker")]
public sealed class DiResolutionTests : IntegrationTestBase
{
    public DiResolutionTests(TestWebApplicationFactory factory) : base(factory) { }

    [Theory]
    [InlineData(typeof(ITokenDiscriminationService))]
    [InlineData(typeof(IAuthenticationService))]
    [InlineData(typeof(IUserProfileService))]
    [InlineData(typeof(IChallengeValidator))]
    [InlineData(typeof(IAppMetadataValidator))]
    [InlineData(typeof(IRegistrationCeremonyOrchestrator))]
    [InlineData(typeof(IParticipationRequestService))]
    [InlineData(typeof(IRequestLifecycleManager))]
    [InlineData(typeof(IExpiryEnforcementService))]
    [InlineData(typeof(INotificationService))]
    [InlineData(typeof(IAttestationProcessingService))]
    [InlineData(typeof(ICounterSigningService))]
    [InlineData(typeof(ISignatureVerificationService))]
    [InlineData(typeof(IJwksService))]
    public void ScopedServices_ResolveSuccessfully(Type serviceType)
    {
        using var scope = Factory.Services.CreateScope();
        var service = scope.ServiceProvider.GetService(serviceType);
        service.Should().NotBeNull($"because {serviceType.Name} must be registered in DI");
    }

    [Theory]
    [InlineData(typeof(IClock))]
    [InlineData(typeof(ITokenGenerator))]
    [InlineData(typeof(ISigner))]
    [InlineData(typeof(ISignatureVerifier))]
    [InlineData(typeof(IKeyEncryptor))]
    [InlineData(typeof(IRateLimitStore))]
    [InlineData(typeof(IEventBroadcaster))]
    [InlineData(typeof(INotificationChannel))]
    [InlineData(typeof(SseNotificationChannel))]
    [InlineData(typeof(IAppIdResolver))]
    [InlineData(typeof(IRequestValidator))]
    [InlineData(typeof(IRequestDeserialiser))]
    public void SingletonServices_ResolveSuccessfully(Type serviceType)
    {
        var service = Factory.Services.GetService(serviceType);
        service.Should().NotBeNull($"because {serviceType.Name} must be registered in DI");
    }

    [Theory]
    [InlineData(typeof(IUserRepository))]
    [InlineData(typeof(IDeviceTokenRepository))]
    [InlineData(typeof(IAppAccessTokenRepository))]
    [InlineData(typeof(IAppRegistrationRepository))]
    [InlineData(typeof(IRegistrationChallengeStore))]
    [InlineData(typeof(IPendingRequestRepository))]
    [InlineData(typeof(IParticipationRecordRepository))]
    [InlineData(typeof(IKeyStore))]
    [InlineData(typeof(IAppMetadataFetcher))]
    [InlineData(typeof(IRegistrationCallbackSender))]
    public void RepositoriesAndInfrastructure_ResolveSuccessfully(Type serviceType)
    {
        using var scope = Factory.Services.CreateScope();
        var service = scope.ServiceProvider.GetService(serviceType);
        service.Should().NotBeNull($"because {serviceType.Name} must be registered in DI");
    }

    [Fact]
    public void PushDispatcher_DefaultsToNoOp_WhenNoFirebaseCredentials()
    {
        // The push dispatcher seam must always resolve. In this test environment
        // (Keycloak auth, no Firebase credentials) it must be the no-op default,
        // not the FCM sender - proving the TryAddScoped default wiring works.
        using var scope = Factory.Services.CreateScope();
        var sender = scope.ServiceProvider.GetService<IPushNotificationSender>();

        sender.Should().NotBeNull("the push dispatcher seam is always registered (at least a no-op)");
        sender.Should().BeOfType<NoOpPushNotificationSender>(
            "dev/test has no Firebase credentials, so FCM must not be registered");
    }
}
