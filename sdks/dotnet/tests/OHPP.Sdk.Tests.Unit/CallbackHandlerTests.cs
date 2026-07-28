using FluentAssertions;
using NSubstitute;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using Xunit;

namespace OHPP.Sdk.Tests.Unit;

public sealed class CallbackHandlerTests
{
    private readonly IRegistrationStore _store = Substitute.For<IRegistrationStore>();
    private readonly CallbackHandler _handler;

    public CallbackHandlerTests()
    {
        _handler = new CallbackHandler(_store);
    }

    [Fact]
    public async Task HandleCallback_ValidPayload_StoresCredentials()
    {
        var response = new RegistrationResponse
        {
            ChallengeId = "challenge-123",
            ResolverBaseUrl = "https://resolver.example.com",
            UserId = "user-abc",
            AccessToken = "ohpp_app_token_xyz",
            RegistrationId = "reg-456",
            CreatedAt = DateTimeOffset.UtcNow
        };
        var json = OhppJsonSerialiser.Serialise(response);

        var result = await _handler.HandleCallbackAsync(json);

        result.Should().NotBeNull();
        result!.ChallengeId.Should().Be("challenge-123");
        result.AccessToken.Should().Be("ohpp_app_token_xyz");
        result.UserId.Should().Be("user-abc");
        await _store.Received(1).StoreRegistrationAsync(
            Arg.Is<RegistrationResponse>(r => r.ChallengeId == "challenge-123"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleCallback_EmptyBody_ReturnsNull()
    {
        var result = await _handler.HandleCallbackAsync("");
        result.Should().BeNull();
    }

    [Fact]
    public async Task HandleCallback_NullBody_ReturnsNull()
    {
        var result = await _handler.HandleCallbackAsync(null!);
        result.Should().BeNull();
    }

    [Fact]
    public async Task HandleCallback_InvalidJson_ReturnsNull()
    {
        var result = await _handler.HandleCallbackAsync("not json at all");
        result.Should().BeNull();
    }

    [Fact]
    public async Task HandleCallback_MissingChallengeId_ReturnsNull()
    {
        var json = """{"resolverBaseUrl":"https://resolver.example.com","userId":"u1","accessToken":"t1","registrationId":"r1","createdAt":"2026-01-01T00:00:00Z"}""";

        var result = await _handler.HandleCallbackAsync(json);
        result.Should().BeNull();
    }

    [Fact]
    public async Task HandleCallback_MissingAccessToken_ReturnsNull()
    {
        var json = """{"challengeId":"c1","resolverBaseUrl":"https://resolver.example.com","userId":"u1","registrationId":"r1","createdAt":"2026-01-01T00:00:00Z"}""";

        var result = await _handler.HandleCallbackAsync(json);
        result.Should().BeNull();
    }
}
