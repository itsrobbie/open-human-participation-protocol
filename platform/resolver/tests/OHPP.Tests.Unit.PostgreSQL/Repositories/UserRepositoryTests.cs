using FluentAssertions;
using OHPP.Domain.Auth;
using OHPP.Infrastructure.PostgreSQL.Repositories;

namespace OHPP.Tests.Unit.PostgreSQL.Repositories;

public sealed class UserRepositoryTests
{
    private static UserRepository CreateSut(out IDisposable context)
    {
        var db = TestDbContextFactory.Create();
        context = db;
        return new UserRepository(db);
    }

    [Fact]
    public async Task CreateAsync_ValidUser_PersistsAndReturnsUser()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new UserRepository(ctx);

        var user = new User
        {
            Id = Guid.NewGuid(),
            ExternalId = "firebase|abc123",
            DisplayName = "Test User",
            Email = "test@example.com",
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        };

        var result = await sut.CreateAsync(user);

        result.Should().NotBeNull();
        result.Id.Should().Be(user.Id);

        var persisted = await ctx.Users.FindAsync(user.Id);
        persisted.Should().NotBeNull();
        persisted!.ExternalId.Should().Be("firebase|abc123");
    }

    [Fact]
    public async Task GetByExternalIdAsync_ExistingUser_ReturnsUser()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new UserRepository(ctx);

        var user = new User
        {
            Id = Guid.NewGuid(),
            ExternalId = "firebase|xyz789",
            DisplayName = "Jane Doe",
            Email = "jane@example.com",
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        };
        ctx.Users.Add(user);
        await ctx.SaveChangesAsync();

        var result = await sut.GetByExternalIdAsync("firebase|xyz789");

        result.Should().NotBeNull();
        result!.Id.Should().Be(user.Id);
        result.DisplayName.Should().Be("Jane Doe");
    }

    [Fact]
    public async Task GetByExternalIdAsync_NonExistentUser_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new UserRepository(ctx);

        var result = await sut.GetByExternalIdAsync("nonexistent");

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_ExistingUser_ReturnsUser()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new UserRepository(ctx);

        var userId = Guid.NewGuid();
        ctx.Users.Add(new User
        {
            Id = userId,
            ExternalId = "firebase|id1",
            DisplayName = "By Id",
            Email = "byid@example.com",
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        });
        await ctx.SaveChangesAsync();

        var result = await sut.GetByIdAsync(userId);

        result.Should().NotBeNull();
        result!.ExternalId.Should().Be("firebase|id1");
    }

    [Fact]
    public async Task GetByIdAsync_NonExistentUser_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new UserRepository(ctx);

        var result = await sut.GetByIdAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task UpdateAsync_ExistingUser_PersistsChanges()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new UserRepository(ctx);

        var user = new User
        {
            Id = Guid.NewGuid(),
            ExternalId = "firebase|update1",
            DisplayName = "Original",
            Email = "original@example.com",
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        };
        ctx.Users.Add(user);
        await ctx.SaveChangesAsync();

        user.DisplayName = "Updated";
        user.LastLoginAt = DateTimeOffset.UtcNow.AddHours(1);
        await sut.UpdateAsync(user);

        var persisted = await ctx.Users.FindAsync(user.Id);
        persisted!.DisplayName.Should().Be("Updated");
    }
}
