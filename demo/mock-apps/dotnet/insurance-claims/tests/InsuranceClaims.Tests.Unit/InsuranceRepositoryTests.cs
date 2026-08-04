using InsuranceClaims.Domain;
using InsuranceClaims.Infrastructure;
using Npgsql;
using OHPP.Protocol.Models;
using Testcontainers.PostgreSql;
using Xunit;

namespace InsuranceClaims.Tests.Unit;

public sealed class InsuranceRepositoryFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("ohpp_repository_tests")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public NpgsqlDataSource DataSource { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await using (var admin = NpgsqlDataSource.Create(_postgres.GetConnectionString()))
        await using (var command = admin.CreateCommand("""
            create role insurance_repository_test login password 'insurance_repository_test';
            create schema insurance_claims authorization insurance_repository_test;
            create schema bank;
            create table bank.secret_records (id integer primary key);
            """))
        {
            await command.ExecuteNonQueryAsync();
        }

        var builder = new NpgsqlConnectionStringBuilder(_postgres.GetConnectionString())
        {
            Username = "insurance_repository_test",
            Password = "insurance_repository_test"
        };
        DataSource = NpgsqlDataSource.Create(builder.ConnectionString);
        var initializer = new ClaimsDatabaseInitializer(DataSource);
        await initializer.InitializeAsync();
        await initializer.InitializeAsync();
    }

    public async Task DisposeAsync()
    {
        await DataSource.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

public sealed class InsuranceRepositoryTests : IClassFixture<InsuranceRepositoryFixture>
{
    private readonly NpgsqlDataSource _dataSource;

    public InsuranceRepositoryTests(InsuranceRepositoryFixture fixture) =>
        _dataSource = fixture.DataSource;

    [Fact]
    public async Task InsurancePolicyRepository_SeedIsIdempotent_DoesNotDuplicatePolicies()
    {
        var policies = await new PostgresPolicyRepository(_dataSource).GetAllAsync("demo-user");

        Assert.Single(policies);
        Assert.Equal("POL-0001", policies[0].PolicyNumber);
    }

    [Fact]
    public async Task ClaimRepository_NewInstance_PreservesLifecycleAffectedItemsNotesAndAttestation()
    {
        var now = new DateTimeOffset(2026, 7, 31, 8, 0, 0, TimeSpan.Zero);
        var claim = new InsuranceClaim
        {
            Id = Guid.NewGuid().ToString(),
            UserId = "demo-user",
            PolicyId = "policy-1",
            ClaimNumber = "CLM-REPOSITORY",
            ClaimantName = "Demo User",
            IncidentDate = new DateOnly(2026, 7, 30),
            IncidentAt = new DateTimeOffset(2026, 7, 30, 8, 45, 0, TimeSpan.Zero),
            Description = "Repository persistence",
            Notes =
            [
                new ClaimNote { Id = "note-1", AuthorType = "claimant", Body = "First note", CreatedAt = now },
                new ClaimNote { Id = "note-2", AuthorType = "reviewer", Body = "Second note", CreatedAt = now.AddMinutes(1) }
            ],
            AffectedItems = ["Building", "Contents"],
            EstimatedAmount = 725,
            Status = ClaimStatus.ApprovedForNextStep,
            ParticipationRequestId = "request-repository",
            ParticipationScenario = ClaimScenario.SelectDisposition,
            SelectedOption = "continue",
            AttestationPayload = "signed-attestation",
            CreatedAt = now,
            UpdatedAt = now.AddMinutes(5)
        };

        await new PostgresClaimRepository(_dataSource).SaveAsync(claim);
        var loaded = await new PostgresClaimRepository(_dataSource).GetAsync(claim.Id, "demo-user");

        Assert.NotNull(loaded);
        Assert.Equal(ClaimStatus.ApprovedForNextStep, loaded.Status);
        Assert.Equal(["Building", "Contents"], loaded.AffectedItems);
        Assert.Equal(["First note", "Second note"], loaded.Notes.OrderBy(note => note.CreatedAt).Select(note => note.Body));
        Assert.Equal("request-repository", loaded.ParticipationRequestId);
        Assert.Equal("continue", loaded.SelectedOption);
        Assert.Equal("signed-attestation", loaded.AttestationPayload);
    }

    [Fact]
    public async Task InsuranceRegistrationRepository_SaveAndLoad_PreservesResolverCredentials()
    {
        var store = new PostgresInsuranceRegistrationStore(_dataSource);
        var createdAt = new DateTimeOffset(2026, 7, 31, 9, 0, 0, TimeSpan.Zero);
        await store.RecordChallengeAsync("challenge-repository", "demo-user", createdAt);
        await store.StoreRegistrationAsync(new RegistrationResponse
        {
            ChallengeId = "challenge-repository",
            ResolverBaseUrl = "https://resolver.test",
            UserId = "resolver-user",
            AccessToken = "resolver-access-token",
            RegistrationId = "registration-repository",
            CreatedAt = createdAt
        });
        var loaded = await new PostgresInsuranceRegistrationStore(_dataSource).GetForAppUserAsync("demo-user");

        Assert.NotNull(loaded);
        Assert.Equal("registration-repository", loaded.RegistrationId);
        Assert.Equal("resolver-access-token", loaded.AccessToken);
        Assert.Equal("resolver-user", loaded.UserId);
    }

    [Fact]
    public async Task InsuranceRegistrationRepository_Revoke_RemovesOnlyTargetUsersCredentials()
    {
        var store = new PostgresInsuranceRegistrationStore(_dataSource);
        var createdAt = DateTimeOffset.UtcNow;
        await store.RecordChallengeAsync("challenge-revoke", "revoke-user", createdAt);
        await store.StoreRegistrationAsync(new RegistrationResponse
        {
            ChallengeId = "challenge-revoke",
            ResolverBaseUrl = "https://resolver.test",
            UserId = "resolver-revoke-user",
            AccessToken = "revoke-token",
            RegistrationId = "registration-revoke",
            CreatedAt = createdAt
        });
        await store.RecordChallengeAsync("challenge-keep", "keep-user", createdAt);
        await store.StoreRegistrationAsync(new RegistrationResponse
        {
            ChallengeId = "challenge-keep",
            ResolverBaseUrl = "https://resolver.test",
            UserId = "resolver-keep-user",
            AccessToken = "keep-token",
            RegistrationId = "registration-keep",
            CreatedAt = createdAt
        });

        await store.RevokeForAppUserAsync("revoke-user");

        Assert.Null(await new PostgresInsuranceRegistrationStore(_dataSource).GetForAppUserAsync("revoke-user"));
        Assert.NotNull(await new PostgresInsuranceRegistrationStore(_dataSource).GetForAppUserAsync("keep-user"));
    }

    [Fact]
    public async Task InsuranceMigration_CreatesTablesAndRoleCannotReadBankSchema()
    {
        await using var tables = _dataSource.CreateCommand("""
            select count(*) from information_schema.tables
            where table_schema = 'insurance_claims'
              and table_name in ('policies', 'claims', 'pending_challenges', 'registrations');
            """);
        Assert.Equal(4L, await tables.ExecuteScalarAsync());

        await using var forbidden = _dataSource.CreateCommand("select count(*) from bank.secret_records");
        var error = await Assert.ThrowsAsync<PostgresException>(() => forbidden.ExecuteScalarAsync());
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, error.SqlState);
    }
}
