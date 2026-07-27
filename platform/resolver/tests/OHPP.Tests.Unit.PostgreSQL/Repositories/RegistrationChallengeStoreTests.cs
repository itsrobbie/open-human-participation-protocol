using FluentAssertions;
using OHPP.Domain.Registration;
using OHPP.Infrastructure.PostgreSQL.Repositories;

namespace OHPP.Tests.Unit.PostgreSQL.Repositories;

public sealed class RegistrationChallengeStoreTests
{
    [Fact]
    public async Task StoreAsync_ValidChallenge_Persists()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new RegistrationChallengeStore(ctx);

        var challenge = new RegistrationChallengeRecord
        {
            ChallengeId = "ch_123",
            RequesterAppId = "bank.example.com",
            UserId = Guid.NewGuid(),
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5),
            CreatedAt = DateTimeOffset.UtcNow,
            IsCompleted = false,
            AppName = "Bank App",
            CallbackPath = "/ohpp/callback"
        };

        await sut.StoreAsync(challenge);

        var persisted = await ctx.RegistrationChallenges.FindAsync("ch_123");
        persisted.Should().NotBeNull();
        persisted!.RequesterAppId.Should().Be("bank.example.com");
    }

    [Fact]
    public async Task GetAsync_ExistingChallenge_Returns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new RegistrationChallengeStore(ctx);

        ctx.RegistrationChallenges.Add(new RegistrationChallengeRecord
        {
            ChallengeId = "ch_get",
            RequesterAppId = "app.test",
            UserId = Guid.NewGuid(),
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5),
            CreatedAt = DateTimeOffset.UtcNow,
            IsCompleted = false
        });
        await ctx.SaveChangesAsync();

        var result = await sut.GetAsync("ch_get");

        result.Should().NotBeNull();
        result!.RequesterAppId.Should().Be("app.test");
    }

    [Fact]
    public async Task GetAsync_NonExistent_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new RegistrationChallengeStore(ctx);

        var result = await sut.GetAsync("nonexistent");

        result.Should().BeNull();
    }

    [Fact]
    public async Task MarkCompletedAsync_ExistingChallenge_SetsIsCompleted()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new RegistrationChallengeStore(ctx);

        ctx.RegistrationChallenges.Add(new RegistrationChallengeRecord
        {
            ChallengeId = "ch_complete",
            RequesterAppId = "app.test",
            UserId = Guid.NewGuid(),
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5),
            CreatedAt = DateTimeOffset.UtcNow,
            IsCompleted = false
        });
        await ctx.SaveChangesAsync();

        await sut.MarkCompletedAsync("ch_complete");

        var persisted = await ctx.RegistrationChallenges.FindAsync("ch_complete");
        persisted!.IsCompleted.Should().BeTrue();
    }
}
