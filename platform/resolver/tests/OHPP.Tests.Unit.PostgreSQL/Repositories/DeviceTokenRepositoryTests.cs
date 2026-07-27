using FluentAssertions;
using OHPP.Domain.Auth;
using OHPP.Infrastructure.PostgreSQL.Repositories;

namespace OHPP.Tests.Unit.PostgreSQL.Repositories;

public sealed class DeviceTokenRepositoryTests
{
    [Fact]
    public async Task CreateAsync_ValidDevice_PersistsAndReturns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new DeviceTokenRepository(ctx);

        var device = new Device
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Name = "iPhone 15",
            DeviceType = "ios",
            DeviceToken = "dvc_abc123",
            IsActive = true,
            RegisteredAt = DateTimeOffset.UtcNow
        };

        var result = await sut.CreateAsync(device);

        result.Should().NotBeNull();
        result.Id.Should().Be(device.Id);

        var persisted = await ctx.Devices.FindAsync(device.Id);
        persisted.Should().NotBeNull();
        persisted!.DeviceToken.Should().Be("dvc_abc123");
    }

    [Fact]
    public async Task GetByIdAsync_ExistingDevice_ReturnsDevice()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new DeviceTokenRepository(ctx);

        var deviceId = Guid.NewGuid();
        ctx.Devices.Add(new Device
        {
            Id = deviceId,
            UserId = Guid.NewGuid(),
            Name = "Pixel 8",
            DeviceType = "android",
            DeviceToken = "dvc_pixel",
            IsActive = true,
            RegisteredAt = DateTimeOffset.UtcNow
        });
        await ctx.SaveChangesAsync();

        var result = await sut.GetByIdAsync(deviceId);

        result.Should().NotBeNull();
        result!.Name.Should().Be("Pixel 8");
    }

    [Fact]
    public async Task GetByIdAsync_NonExistent_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new DeviceTokenRepository(ctx);

        var result = await sut.GetByIdAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByTokenAsync_ExistingToken_ReturnsDevice()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new DeviceTokenRepository(ctx);

        ctx.Devices.Add(new Device
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Name = "Token Device",
            DeviceType = "ios",
            DeviceToken = "dvc_findme",
            IsActive = true,
            RegisteredAt = DateTimeOffset.UtcNow
        });
        await ctx.SaveChangesAsync();

        var result = await sut.GetByTokenAsync("dvc_findme");

        result.Should().NotBeNull();
        result!.Name.Should().Be("Token Device");
    }

    [Fact]
    public async Task GetByTokenAsync_NonExistent_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new DeviceTokenRepository(ctx);

        var result = await sut.GetByTokenAsync("nonexistent");

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetActiveByUserIdAsync_ReturnsOnlyActiveDevices()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new DeviceTokenRepository(ctx);

        var userId = Guid.NewGuid();
        ctx.Devices.AddRange(
            new Device
            {
                Id = Guid.NewGuid(), UserId = userId, Name = "Active 1",
                DeviceType = "ios", DeviceToken = "dvc_a1", IsActive = true,
                RegisteredAt = DateTimeOffset.UtcNow
            },
            new Device
            {
                Id = Guid.NewGuid(), UserId = userId, Name = "Inactive",
                DeviceType = "android", DeviceToken = "dvc_inactive", IsActive = false,
                RegisteredAt = DateTimeOffset.UtcNow
            },
            new Device
            {
                Id = Guid.NewGuid(), UserId = userId, Name = "Active 2",
                DeviceType = "ios", DeviceToken = "dvc_a2", IsActive = true,
                RegisteredAt = DateTimeOffset.UtcNow
            }
        );
        await ctx.SaveChangesAsync();

        var result = await sut.GetActiveByUserIdAsync(userId);

        result.Should().HaveCount(2);
        result.Should().OnlyContain(d => d.IsActive);
    }

    [Fact]
    public async Task GetByUserIdAsync_ReturnsAllDevicesForUser()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new DeviceTokenRepository(ctx);

        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        ctx.Devices.AddRange(
            new Device
            {
                Id = Guid.NewGuid(), UserId = userId, Name = "Mine 1",
                DeviceType = "ios", DeviceToken = "dvc_m1", IsActive = true,
                RegisteredAt = DateTimeOffset.UtcNow
            },
            new Device
            {
                Id = Guid.NewGuid(), UserId = userId, Name = "Mine 2",
                DeviceType = "ios", DeviceToken = "dvc_m2", IsActive = false,
                RegisteredAt = DateTimeOffset.UtcNow
            },
            new Device
            {
                Id = Guid.NewGuid(), UserId = otherUserId, Name = "Not Mine",
                DeviceType = "android", DeviceToken = "dvc_other", IsActive = true,
                RegisteredAt = DateTimeOffset.UtcNow
            }
        );
        await ctx.SaveChangesAsync();

        var result = await sut.GetByUserIdAsync(userId);

        result.Should().HaveCount(2);
        result.Should().OnlyContain(d => d.UserId == userId);
    }

    [Fact]
    public async Task UpdateAsync_ExistingDevice_PersistsChanges()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new DeviceTokenRepository(ctx);

        var device = new Device
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Name = "Old Name",
            DeviceType = "ios",
            DeviceToken = "dvc_update",
            IsActive = true,
            RegisteredAt = DateTimeOffset.UtcNow
        };
        ctx.Devices.Add(device);
        await ctx.SaveChangesAsync();

        device.Name = "New Name";
        device.PublicKey = "-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----";
        device.KeyAlgorithm = "ES256";
        await sut.UpdateAsync(device);

        var persisted = await ctx.Devices.FindAsync(device.Id);
        persisted!.Name.Should().Be("New Name");
        persisted.PublicKey.Should().Contain("PUBLIC KEY");
        persisted.KeyAlgorithm.Should().Be("ES256");
    }
}
