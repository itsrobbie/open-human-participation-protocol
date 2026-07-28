using FluentAssertions;
using OHPP.Domain.Participation;
using OHPP.Infrastructure.PostgreSQL.Repositories;

namespace OHPP.Tests.Unit.PostgreSQL.Repositories;

public sealed class PendingRequestRepositoryTests
{
    private static PendingRequest CreateRequest(
        Guid? id = null,
        Guid? userId = null,
        Guid? appRegId = null,
        string status = "Pending",
        DateTimeOffset? expiresAt = null)
    {
        return new PendingRequest
        {
            Id = id ?? Guid.NewGuid(),
            AppRegistrationId = appRegId ?? Guid.NewGuid(),
            UserId = userId ?? Guid.NewGuid(),
            Status = status,
            RequestPayload = """{"type":"select","options":[]}""",
            AppId = "bank.example.com",
            ActionSummary = "Approve transfer",
            Type = "select",
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = expiresAt
        };
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_PersistsAndReturns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new PendingRequestRepository(ctx);

        var request = CreateRequest();
        var result = await sut.CreateAsync(request);

        result.Should().NotBeNull();
        result.Id.Should().Be(request.Id);

        var persisted = await ctx.PendingRequests.FindAsync(request.Id);
        persisted.Should().NotBeNull();
        persisted!.ActionSummary.Should().Be("Approve transfer");
    }

    [Fact]
    public async Task GetByIdAsync_Existing_Returns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new PendingRequestRepository(ctx);

        var request = CreateRequest();
        ctx.PendingRequests.Add(request);
        await ctx.SaveChangesAsync();

        var result = await sut.GetByIdAsync(request.Id);

        result.Should().NotBeNull();
        result!.AppId.Should().Be("bank.example.com");
    }

    [Fact]
    public async Task GetByIdAsync_NonExistent_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new PendingRequestRepository(ctx);

        var result = await sut.GetByIdAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdForAppAsync_MatchingApp_Returns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new PendingRequestRepository(ctx);

        var appRegId = Guid.NewGuid();
        var request = CreateRequest(appRegId: appRegId);
        ctx.PendingRequests.Add(request);
        await ctx.SaveChangesAsync();

        var result = await sut.GetByIdForAppAsync(request.Id, appRegId);

        result.Should().NotBeNull();
    }

    [Fact]
    public async Task GetByIdForAppAsync_WrongApp_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new PendingRequestRepository(ctx);

        var request = CreateRequest(appRegId: Guid.NewGuid());
        ctx.PendingRequests.Add(request);
        await ctx.SaveChangesAsync();

        var result = await sut.GetByIdForAppAsync(request.Id, Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetPendingByUserIdAsync_ReturnsOnlyPendingForUser()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new PendingRequestRepository(ctx);

        var userId = Guid.NewGuid();
        ctx.PendingRequests.AddRange(
            CreateRequest(userId: userId, status: "Pending"),
            CreateRequest(userId: userId, status: "Resolved"),
            CreateRequest(userId: userId, status: "Pending"),
            CreateRequest(userId: Guid.NewGuid(), status: "Pending")
        );
        await ctx.SaveChangesAsync();

        var result = await sut.GetPendingByUserIdAsync(userId);

        result.Should().HaveCount(2);
        result.Should().OnlyContain(r => r.UserId == userId && r.Status == "Pending");
    }

    [Fact]
    public async Task GetExpiredPendingAsync_ReturnsExpiredPendingRequests()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new PendingRequestRepository(ctx);

        var now = DateTimeOffset.UtcNow;
        ctx.PendingRequests.AddRange(
            CreateRequest(status: "Pending", expiresAt: now.AddMinutes(-5)),
            CreateRequest(status: "Pending", expiresAt: now.AddMinutes(5)),
            CreateRequest(status: "Resolved", expiresAt: now.AddMinutes(-5)),
            CreateRequest(status: "Pending", expiresAt: null)
        );
        await ctx.SaveChangesAsync();

        var result = await sut.GetExpiredPendingAsync(now);

        result.Should().HaveCount(1);
        result[0].Status.Should().Be("Pending");
        result[0].ExpiresAt.Should().BeBefore(now);
    }

    [Fact]
    public async Task UpdateStatusAsync_ExistingRequest_UpdatesStatusAndResolvedAt()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new PendingRequestRepository(ctx);

        var request = CreateRequest(status: "Pending");
        ctx.PendingRequests.Add(request);
        await ctx.SaveChangesAsync();

        var resolvedAt = DateTimeOffset.UtcNow;
        await sut.UpdateStatusAsync(request.Id, "resolved", resolvedAt);

        var persisted = await ctx.PendingRequests.FindAsync(request.Id);
        persisted!.Status.Should().Be("resolved");
        persisted.ResolvedAt.Should().Be(resolvedAt);
    }

    [Fact]
    public async Task CancelAllForAppRegistrationAsync_CancelsPendingOnly()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new PendingRequestRepository(ctx);

        var appRegId = Guid.NewGuid();
        ctx.PendingRequests.AddRange(
            CreateRequest(appRegId: appRegId, status: "Pending"),
            CreateRequest(appRegId: appRegId, status: "Pending"),
            CreateRequest(appRegId: appRegId, status: "Resolved"),
            CreateRequest(appRegId: Guid.NewGuid(), status: "Pending")
        );
        await ctx.SaveChangesAsync();

        await sut.CancelAllForAppRegistrationAsync(appRegId);

        var remaining = ctx.PendingRequests
            .Where(r => r.AppRegistrationId == appRegId && r.Status == "Pending")
            .ToList();
        remaining.Should().BeEmpty();

        var cancelled = ctx.PendingRequests
            .Where(r => r.AppRegistrationId == appRegId && r.Status == "Cancelled")
            .ToList();
        cancelled.Should().HaveCount(2);
    }

    [Fact]
    public async Task CountPendingByUserIdAsync_ReturnsCorrectCount()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new PendingRequestRepository(ctx);

        var userId = Guid.NewGuid();
        ctx.PendingRequests.AddRange(
            CreateRequest(userId: userId, status: "Pending"),
            CreateRequest(userId: userId, status: "Pending"),
            CreateRequest(userId: userId, status: "Resolved"),
            CreateRequest(userId: Guid.NewGuid(), status: "Pending")
        );
        await ctx.SaveChangesAsync();

        var count = await sut.CountPendingByUserIdAsync(userId);

        count.Should().Be(2);
    }
}
