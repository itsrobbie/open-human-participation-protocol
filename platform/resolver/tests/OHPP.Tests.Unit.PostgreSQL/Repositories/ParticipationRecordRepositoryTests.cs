using FluentAssertions;
using OHPP.Domain.Participation;
using OHPP.Infrastructure.PostgreSQL.Repositories;

namespace OHPP.Tests.Unit.PostgreSQL.Repositories;

public sealed class ParticipationRecordRepositoryTests
{
    private static ParticipationRecord CreateRecord(
        Guid? id = null,
        Guid? requestId = null,
        Guid? userId = null,
        DateTimeOffset? createdAt = null)
    {
        return new ParticipationRecord
        {
            Id = id ?? Guid.NewGuid(),
            RequestId = requestId ?? Guid.NewGuid(),
            UserId = userId ?? Guid.NewGuid(),
            AppRegistrationId = Guid.NewGuid(),
            Status = "resolved",
            AppId = "bank.example.com",
            AppName = "Bank App",
            ActionSummary = "Approved transfer",
            Type = "select",
            Category = "finance",
            ResolutionMethod = "direct",
            CreatedAt = createdAt ?? DateTimeOffset.UtcNow
        };
    }

    [Fact]
    public async Task CreateAsync_ValidRecord_PersistsAndReturns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new ParticipationRecordRepository(ctx);

        var record = CreateRecord();
        var result = await sut.CreateAsync(record);

        result.Should().NotBeNull();
        result.Id.Should().Be(record.Id);

        var persisted = await ctx.ParticipationRecords.FindAsync(record.Id);
        persisted.Should().NotBeNull();
        persisted!.AppName.Should().Be("Bank App");
    }

    [Fact]
    public async Task GetByRequestIdAsync_ExistingRecord_Returns()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new ParticipationRecordRepository(ctx);

        var requestId = Guid.NewGuid();
        ctx.ParticipationRecords.Add(CreateRecord(requestId: requestId));
        await ctx.SaveChangesAsync();

        var result = await sut.GetByRequestIdAsync(requestId);

        result.Should().NotBeNull();
        result!.RequestId.Should().Be(requestId);
    }

    [Fact]
    public async Task GetByRequestIdAsync_NonExistent_ReturnsNull()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new ParticipationRecordRepository(ctx);

        var result = await sut.GetByRequestIdAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByUserIdAsync_ReturnsPagedResults_OrderedByCreatedAtDesc()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new ParticipationRecordRepository(ctx);

        var userId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        for (var i = 0; i < 15; i++)
        {
            ctx.ParticipationRecords.Add(CreateRecord(userId: userId, createdAt: now.AddHours(-i)));
        }
        // Add records for other user
        ctx.ParticipationRecords.Add(CreateRecord(userId: Guid.NewGuid()));
        await ctx.SaveChangesAsync();

        var result = await sut.GetByUserIdAsync(userId, page: 1, pageSize: 10);

        result.Items.Should().HaveCount(10);
        result.TotalCount.Should().Be(15);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
        result.HasNextPage.Should().BeTrue();
        result.HasPreviousPage.Should().BeFalse();

        // Verify ordering — most recent first
        result.Items[0].CreatedAt.Should().BeOnOrAfter(result.Items[1].CreatedAt);
    }

    [Fact]
    public async Task GetByUserIdAsync_SecondPage_ReturnsRemaining()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new ParticipationRecordRepository(ctx);

        var userId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        for (var i = 0; i < 15; i++)
        {
            ctx.ParticipationRecords.Add(CreateRecord(userId: userId, createdAt: now.AddHours(-i)));
        }
        await ctx.SaveChangesAsync();

        var result = await sut.GetByUserIdAsync(userId, page: 2, pageSize: 10);

        result.Items.Should().HaveCount(5);
        result.TotalCount.Should().Be(15);
        result.Page.Should().Be(2);
        result.HasNextPage.Should().BeFalse();
        result.HasPreviousPage.Should().BeTrue();
    }

    [Fact]
    public async Task GetByUserIdAsync_NoRecords_ReturnsEmptyPage()
    {
        using var ctx = TestDbContextFactory.Create();
        var sut = new ParticipationRecordRepository(ctx);

        var result = await sut.GetByUserIdAsync(Guid.NewGuid(), page: 1, pageSize: 10);

        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
        result.HasNextPage.Should().BeFalse();
    }
}
