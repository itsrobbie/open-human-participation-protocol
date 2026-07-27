using FluentAssertions;
using NSubstitute;
using OHPP.Domain.Shared;
using OHPP.Infrastructure.DotNet.RateLimiting;
using Xunit;

namespace OHPP.Tests.Unit.Auth.Infrastructure;

public class InMemoryRateLimitStoreTests
{
    private readonly IClock _clock = Substitute.For<IClock>();
    private readonly InMemoryRateLimitStore _sut;

    private static readonly DateTimeOffset Now = new(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);

    public InMemoryRateLimitStoreTests()
    {
        _clock.UtcNow.Returns(Now);
        _sut = new InMemoryRateLimitStore(_clock);
    }

    [Fact]
    public async Task IsRateLimited_UnderLimit_ReturnsFalse()
    {
        var result = await _sut.IsRateLimitedAsync("key1", 5, TimeSpan.FromMinutes(1));
        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsRateLimited_AtLimit_ReturnsTrue()
    {
        var window = TimeSpan.FromMinutes(1);
        for (var i = 0; i < 5; i++)
            await _sut.IncrementAsync("key2", window);

        var result = await _sut.IsRateLimitedAsync("key2", 5, window);
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsRateLimited_ExpiredEntries_ArePruned()
    {
        var window = TimeSpan.FromMinutes(1);

        // Add 5 entries at "now"
        for (var i = 0; i < 5; i++)
            await _sut.IncrementAsync("key3", window);

        // Advance time past the window
        _clock.UtcNow.Returns(Now.AddMinutes(2));

        var result = await _sut.IsRateLimitedAsync("key3", 5, window);
        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsRateLimited_DifferentKeys_AreIndependent()
    {
        var window = TimeSpan.FromMinutes(1);
        for (var i = 0; i < 5; i++)
            await _sut.IncrementAsync("keyA", window);

        var resultA = await _sut.IsRateLimitedAsync("keyA", 5, window);
        var resultB = await _sut.IsRateLimitedAsync("keyB", 5, window);

        resultA.Should().BeTrue();
        resultB.Should().BeFalse();
    }
}
