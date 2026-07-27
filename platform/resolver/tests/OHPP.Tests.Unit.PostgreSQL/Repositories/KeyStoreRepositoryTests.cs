using FluentAssertions;
using OHPP.Domain.Attestation;
using OHPP.Infrastructure.PostgreSQL.Repositories;

namespace OHPP.Tests.Unit.PostgreSQL.Repositories;

public sealed class KeyStoreRepositoryTests
{
    private static SigningKey CreateKey(string? keyId = null, bool isActive = true, DateTimeOffset? retiredAt = null)
    {
        return new SigningKey
        {
            KeyId = keyId ?? $"key_{Guid.NewGuid():N}",
            Algorithm = "ES256",
            PublicKeyPem = "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----",
            PrivateKeyPem = "-----BEGIN EC PRIVATE KEY-----\nencrypted\n-----END EC PRIVATE KEY-----",
            IsActive = isActive,
            CreatedAt = DateTimeOffset.UtcNow,
            RetiredAt = retiredAt
        };
    }

    [Fact]
    public async Task CreateKeyAsync_ValidKey_PersistsAndReturns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new KeyStoreRepository(ctx);

        var key = CreateKey(keyId: "key_new");
        var result = await sut.CreateKeyAsync(key);

        result.Should().NotBeNull();
        result.KeyId.Should().Be("key_new");

        var persisted = await ctx.SigningKeys.FindAsync("key_new");
        persisted.Should().NotBeNull();
        persisted!.Algorithm.Should().Be("ES256");
    }

    [Fact]
    public async Task GetActiveKeyAsync_ActiveKeyExists_ReturnsIt()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new KeyStoreRepository(ctx);

        ctx.SigningKeys.AddRange(
            CreateKey(keyId: "key_retired", isActive: false, retiredAt: DateTimeOffset.UtcNow),
            CreateKey(keyId: "key_active", isActive: true)
        );
        await ctx.SaveChangesAsync();

        var result = await sut.GetActiveKeyAsync();

        result.Should().NotBeNull();
        result!.KeyId.Should().Be("key_active");
    }

    [Fact]
    public async Task GetActiveKeyAsync_NoActiveKey_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new KeyStoreRepository(ctx);

        ctx.SigningKeys.Add(CreateKey(isActive: false, retiredAt: DateTimeOffset.UtcNow));
        await ctx.SaveChangesAsync();

        var result = await sut.GetActiveKeyAsync();

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByKeyIdAsync_ExistingKey_Returns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new KeyStoreRepository(ctx);

        ctx.SigningKeys.Add(CreateKey(keyId: "key_find"));
        await ctx.SaveChangesAsync();

        var result = await sut.GetByKeyIdAsync("key_find");

        result.Should().NotBeNull();
        result!.KeyId.Should().Be("key_find");
    }

    [Fact]
    public async Task GetByKeyIdAsync_NonExistent_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new KeyStoreRepository(ctx);

        var result = await sut.GetByKeyIdAsync("nonexistent");

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetAllKeysAsync_ReturnsAllIncludingRetired()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new KeyStoreRepository(ctx);

        ctx.SigningKeys.AddRange(
            CreateKey(keyId: "key_1", isActive: true),
            CreateKey(keyId: "key_2", isActive: false, retiredAt: DateTimeOffset.UtcNow)
        );
        await ctx.SaveChangesAsync();

        var result = await sut.GetAllKeysAsync();

        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task RetireKeyAsync_ActiveKey_SetsRetiredAtAndDeactivates()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new KeyStoreRepository(ctx);

        ctx.SigningKeys.Add(CreateKey(keyId: "key_retire", isActive: true));
        await ctx.SaveChangesAsync();

        await sut.RetireKeyAsync("key_retire");

        var persisted = await ctx.SigningKeys.FindAsync("key_retire");
        persisted!.IsActive.Should().BeFalse();
        persisted.RetiredAt.Should().NotBeNull();
    }
}
