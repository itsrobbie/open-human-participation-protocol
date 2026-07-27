using FluentAssertions;
using OHPP.Domain.Registration;
using OHPP.Infrastructure.PostgreSQL.Repositories;

namespace OHPP.Tests.Unit.PostgreSQL.Repositories;

public sealed class AppRegistrationRepositoryTests
{
    [Fact]
    public async Task CreateAsync_ValidRegistration_PersistsAndReturns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new AppRegistrationRepository(ctx);

        var reg = new AppRegistration
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            AppId = "pizza.example.com",
            AppName = "Pizza App",
            AccessToken = "app_pizza",
            ResolverBaseUrl = "https://resolver.test",
            RegisteredAt = DateTimeOffset.UtcNow
        };

        var result = await sut.CreateAsync(reg);

        result.Should().NotBeNull();
        result.Id.Should().Be(reg.Id);

        var persisted = await ctx.AppRegistrations.FindAsync(reg.Id);
        persisted.Should().NotBeNull();
        persisted!.AppId.Should().Be("pizza.example.com");
    }

    [Fact]
    public async Task GetByIdAsync_ExistingRegistration_Returns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new AppRegistrationRepository(ctx);

        var regId = Guid.NewGuid();
        ctx.AppRegistrations.Add(new AppRegistration
        {
            Id = regId,
            UserId = Guid.NewGuid(),
            AppId = "bank.example.com",
            AppName = "Bank",
            AccessToken = "app_bank",
            ResolverBaseUrl = "https://resolver.test",
            RegisteredAt = DateTimeOffset.UtcNow
        });
        await ctx.SaveChangesAsync();

        var result = await sut.GetByIdAsync(regId);

        result.Should().NotBeNull();
        result!.AppName.Should().Be("Bank");
    }

    [Fact]
    public async Task GetByIdAsync_NonExistent_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new AppRegistrationRepository(ctx);

        var result = await sut.GetByIdAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetActiveByUserAndAppIdAsync_ActiveRegistration_Returns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new AppRegistrationRepository(ctx);

        var userId = Guid.NewGuid();
        ctx.AppRegistrations.Add(new AppRegistration
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AppId = "active.test",
            AppName = "Active App",
            AccessToken = "app_active",
            ResolverBaseUrl = "https://resolver.test",
            RegisteredAt = DateTimeOffset.UtcNow
        });
        await ctx.SaveChangesAsync();

        var result = await sut.GetActiveByUserAndAppIdAsync(userId, "active.test");

        result.Should().NotBeNull();
        result!.AppName.Should().Be("Active App");
    }

    [Fact]
    public async Task GetActiveByUserAndAppIdAsync_RevokedRegistration_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new AppRegistrationRepository(ctx);

        var userId = Guid.NewGuid();
        ctx.AppRegistrations.Add(new AppRegistration
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AppId = "revoked.test",
            AppName = "Revoked App",
            AccessToken = "app_rev",
            ResolverBaseUrl = "https://resolver.test",
            RegisteredAt = DateTimeOffset.UtcNow,
            RevokedAt = DateTimeOffset.UtcNow
        });
        await ctx.SaveChangesAsync();

        var result = await sut.GetActiveByUserAndAppIdAsync(userId, "revoked.test");

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByUserIdAsync_ReturnsAllForUser()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new AppRegistrationRepository(ctx);

        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        ctx.AppRegistrations.AddRange(
            new AppRegistration
            {
                Id = Guid.NewGuid(), UserId = userId, AppId = "a.test",
                AppName = "A", AccessToken = "app_a",
                ResolverBaseUrl = "https://r.test", RegisteredAt = DateTimeOffset.UtcNow
            },
            new AppRegistration
            {
                Id = Guid.NewGuid(), UserId = userId, AppId = "b.test",
                AppName = "B", AccessToken = "app_b",
                ResolverBaseUrl = "https://r.test", RegisteredAt = DateTimeOffset.UtcNow
            },
            new AppRegistration
            {
                Id = Guid.NewGuid(), UserId = otherUserId, AppId = "c.test",
                AppName = "C", AccessToken = "app_c",
                ResolverBaseUrl = "https://r.test", RegisteredAt = DateTimeOffset.UtcNow
            }
        );
        await ctx.SaveChangesAsync();

        var result = await sut.GetByUserIdAsync(userId);

        result.Should().HaveCount(2);
        result.Should().OnlyContain(r => r.UserId == userId);
    }

    [Fact]
    public async Task UpdateAsync_ExistingRegistration_PersistsChanges()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new AppRegistrationRepository(ctx);

        var reg = new AppRegistration
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            AppId = "update.test",
            AppName = "Original",
            AccessToken = "app_upd",
            ResolverBaseUrl = "https://r.test",
            RegisteredAt = DateTimeOffset.UtcNow
        };
        ctx.AppRegistrations.Add(reg);
        await ctx.SaveChangesAsync();

        var revokedAt = DateTimeOffset.UtcNow;
        reg.RevokedAt = revokedAt;
        await sut.UpdateAsync(reg);

        var persisted = await ctx.AppRegistrations.FindAsync(reg.Id);
        persisted!.RevokedAt.Should().Be(revokedAt);
    }
}
