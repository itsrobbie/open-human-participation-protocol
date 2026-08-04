using Bank.Domain;
using Bank.Infrastructure;
using Npgsql;
using OHPP.Protocol.Models;
using Testcontainers.PostgreSql;
using Xunit;

namespace Bank.Tests.Unit;

public sealed class BankRepositoryFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("ohpp_bank_repository_tests")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public NpgsqlDataSource DataSource { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await using (var admin = NpgsqlDataSource.Create(_postgres.GetConnectionString()))
        await using (var command = admin.CreateCommand("""
            create role bank_repository_test login password 'bank_repository_test';
            create schema bank authorization bank_repository_test;
            create schema insurance_claims;
            create table insurance_claims.secret_records (id integer primary key);
            """))
        {
            await command.ExecuteNonQueryAsync();
        }

        var builder = new NpgsqlConnectionStringBuilder(_postgres.GetConnectionString())
        {
            Username = "bank_repository_test",
            Password = "bank_repository_test"
        };
        DataSource = NpgsqlDataSource.Create(builder.ConnectionString);
        var initializer = new WorldDatabaseInitializer(DataSource);
        await initializer.InitializeAsync();
        await initializer.InitializeAsync();
    }

    public async Task DisposeAsync()
    {
        await DataSource.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

public sealed class BankRepositoryTests : IClassFixture<BankRepositoryFixture>
{
    private readonly NpgsqlDataSource _dataSource;

    public BankRepositoryTests(BankRepositoryFixture fixture) => _dataSource = fixture.DataSource;

    [Fact]
    public async Task BankAccountRepository_SeedIsIdempotent_DoesNotDuplicateAccounts()
    {
        var accounts = await new PostgresAccountStore(_dataSource).GetAllAsync();

        Assert.Equal(2, accounts.Count);
        Assert.Contains(accounts, account => account.Id == "demo-account");
        Assert.Contains(accounts, account => account.Id == "demo-current");
    }

    [Fact]
    public async Task BankAccountRepository_NewInstance_PreservesBalancePayeesAndRegistration()
    {
        var store = new PostgresAccountStore(_dataSource);
        var account = await store.GetByIdAsync("demo-account");
        Assert.NotNull(account);
        account.Balance = 4321.50m;
        account.Payees.Add(new Payee
        {
            Id = "payee-repository",
            Name = "Repository Payee",
            AccountNumber = "12345678",
            SortCode = "11-22-33"
        });
        account.OhppRegistration = new OhppRegistration
        {
            ResolverUrl = "https://resolver.test",
            AccessToken = "account-access-token",
            UserId = "resolver-user"
        };
        await store.SaveAsync(account);

        var loaded = await new PostgresAccountStore(_dataSource).GetByIdAsync("demo-account");

        Assert.NotNull(loaded);
        Assert.Equal(4321.50m, loaded.Balance);
        Assert.Contains(loaded.Payees, payee => payee.Id == "payee-repository");
        Assert.Equal("account-access-token", loaded.OhppRegistration?.AccessToken);
    }

    [Fact]
    public async Task BankTransactionRepository_RecordResolveAndQuery_PreservesCorrelationAndDurability()
    {
        var transactionId = Guid.NewGuid().ToString();
        var createdAt = new DateTimeOffset(2026, 7, 31, 8, 0, 0, TimeSpan.Zero);
        var store = new PostgresTransactionStore(_dataSource);
        await store.RecordAsync(new TransactionRecord
        {
            Id = transactionId,
            AccountId = "demo-account",
            PayeeName = "Repository Payee",
            Amount = 25m,
            Reference = "repository-test",
            Status = TransferStatus.PendingApproval,
            ParticipationRequestId = "participation-repository",
            CreatedAt = createdAt
        });

        Assert.True(await store.TryResolveAsync(transactionId, TransferStatus.Completed, createdAt.AddMinutes(1)));
        Assert.False(await store.TryResolveAsync(transactionId, TransferStatus.Completed, createdAt.AddMinutes(2)));
        var loaded = await new PostgresTransactionStore(_dataSource)
            .GetByParticipationRequestIdAsync("participation-repository");

        Assert.NotNull(loaded);
        Assert.Equal(TransferStatus.Completed, loaded.Status);
        Assert.Equal("participation-repository", loaded.ParticipationRequestId);
        Assert.Equal(createdAt.AddMinutes(1), loaded.ResolvedAt);
    }

    [Fact]
    public async Task BankRegistrationRepository_SaveAndLoad_PreservesResolverCredentials()
    {
        var store = new PostgresRegistrationStore(_dataSource);
        var createdAt = new DateTimeOffset(2026, 7, 31, 9, 0, 0, TimeSpan.Zero);
        await store.RecordChallengeAsync("bank-challenge-repository", "demo-account", "demo-user", createdAt);
        await store.StoreRegistrationAsync(new RegistrationResponse
        {
            ChallengeId = "bank-challenge-repository",
            ResolverBaseUrl = "https://resolver.test",
            UserId = "resolver-user",
            AccessToken = "registration-access-token",
            RegistrationId = "bank-registration-repository",
            CreatedAt = createdAt
        });

        var loaded = await new PostgresRegistrationStore(_dataSource)
            .GetRegistrationAsync("resolver-user", "https://resolver.test");

        Assert.NotNull(loaded);
        Assert.Equal("bank-registration-repository", loaded.RegistrationId);
        Assert.Equal("registration-access-token", loaded.AccessToken);
    }

    [Fact]
    public async Task BankMigration_CreatesTablesAndRoleCannotReadInsuranceSchema()
    {
        await using var tables = _dataSource.CreateCommand("""
            select count(*) from information_schema.tables
            where table_schema = 'bank'
              and table_name in ('accounts', 'transactions', 'pending_challenges', 'registrations');
            """);
        Assert.Equal(4L, await tables.ExecuteScalarAsync());

        await using var forbidden = _dataSource.CreateCommand("select count(*) from insurance_claims.secret_records");
        var error = await Assert.ThrowsAsync<PostgresException>(() => forbidden.ExecuteScalarAsync());
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, error.SqlState);
    }
}
