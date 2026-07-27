using FluentAssertions;
using OHPP.Domain.Registration;
using OHPP.Infrastructure.PostgreSQL.Repositories;

namespace OHPP.Tests.Unit.PostgreSQL.Repositories;

public sealed class AppAccessTokenRepositoryTests
{
    [Fact]
    public async Task GetByTokenAsync_ExistingToken_ReturnsProjection()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new AppAccessTokenRepository(ctx);

        var userId = Guid.NewGuid();
        var regId = Guid.NewGuid();
        ctx.AppRegistrations.Add(new AppRegistration
        {
            Id = regId,
            UserId = userId,
            AppId = "bank.example.com",
            AppName = "Bank App",
            AccessToken = "app_token123",
            ResolverBaseUrl = "https://resolver.example.com",
            RegisteredAt = DateTimeOffset.UtcNow
        });
        await ctx.SaveChangesAsync();

        var result = await sut.GetByTokenAsync("app_token123");

        result.Should().NotBeNull();
        result!.AppRegistrationId.Should().Be(regId);
        result.UserId.Should().Be(userId);
        result.AppId.Should().Be("bank.example.com");
        result.RevokedAt.Should().BeNull();
    }

    [Fact]
    public async Task GetByTokenAsync_RevokedApp_ReturnsProjectionWithRevokedAt()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new AppAccessTokenRepository(ctx);

        var revokedAt = DateTimeOffset.UtcNow.AddDays(-1);
        ctx.AppRegistrations.Add(new AppRegistration
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            AppId = "revoked.example.com",
            AppName = "Revoked App",
            AccessToken = "app_revoked",
            ResolverBaseUrl = "https://resolver.example.com",
            RegisteredAt = DateTimeOffset.UtcNow.AddDays(-7),
            RevokedAt = revokedAt
        });
        await ctx.SaveChangesAsync();

        var result = await sut.GetByTokenAsync("app_revoked");

        result.Should().NotBeNull();
        result!.RevokedAt.Should().Be(revokedAt);
    }

    [Fact]
    public async Task GetByTokenAsync_NonExistentToken_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new AppAccessTokenRepository(ctx);

        var result = await sut.GetByTokenAsync("nonexistent");

        result.Should().BeNull();
    }
}
