using System.Text.Json;
using Bank.Domain;
using Npgsql;
using OHPP.Protocol.Models;
using OHPP.Sdk;

namespace Bank.Infrastructure;

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

public sealed class WorldDatabaseInitializer
{
    private readonly NpgsqlDataSource _dataSource;

    public WorldDatabaseInitializer(NpgsqlDataSource dataSource) => _dataSource = dataSource;

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("""
            create table if not exists bank.accounts (
                id text primary key,
                owner_user_id text not null default 'demo-user',
                name text not null,
                balance numeric(18,2) not null,
                payees jsonb not null,
                resolver_url text null,
                access_token text null,
                user_id text null
            );
            alter table bank.accounts add column if not exists owner_user_id text not null default 'demo-user';
            create table if not exists bank.transactions (
                id text primary key,
                account_id text not null references bank.accounts(id),
                payee_name text not null,
                amount numeric(18,2) not null,
                reference text null,
                status text not null,
                participation_request_id text null,
                created_at timestamptz not null,
                resolved_at timestamptz null
                ,scheduled_for timestamptz null
            );
            alter table bank.transactions add column if not exists scheduled_for timestamptz null;
            create table if not exists bank.registrations (
                registration_id text primary key,
                challenge_id text not null,
                resolver_base_url text not null,
                user_id text not null,
                access_token text not null,
                created_at timestamptz not null
            );
            create table if not exists bank.pending_challenges (
                challenge_id text primary key,
                account_id text not null references bank.accounts(id),
                app_user_id text not null,
                created_at timestamptz not null
            );
            """);
        await command.ExecuteNonQueryAsync(cancellationToken);

        await using var seed = _dataSource.CreateCommand("""
            insert into bank.accounts (id, owner_user_id, name, balance, payees)
            values ($1, $2, $3, $4, $5::jsonb)
            on conflict (id) do nothing;
            """);
        seed.Parameters.AddWithValue("demo-account");
        seed.Parameters.AddWithValue("demo-user");
        seed.Parameters.AddWithValue("Demo Savings Account");
        seed.Parameters.AddWithValue(5000m);
        seed.Parameters.AddWithValue(JsonSerializer.Serialize(new[]
        {
            new Payee { Id = "payee-landlord", Name = "Landlord - J. Smith", AccountNumber = "40205678", SortCode = "20-30-40" },
            new Payee { Id = "payee-electric", Name = "Electric Co.", AccountNumber = "11223344", SortCode = "10-20-30" },
            new Payee { Id = "payee-friend", Name = "Alex (friend)", AccountNumber = "87654321", SortCode = "40-50-60" }
        }));
        await seed.ExecuteNonQueryAsync(cancellationToken);

        await using var currentAccountSeed = _dataSource.CreateCommand("""
            insert into bank.accounts (id, owner_user_id, name, balance, payees)
            values ($1, $2, $3, $4, $5::jsonb)
            on conflict (id) do nothing;
            """);
        currentAccountSeed.Parameters.AddWithValue("demo-current");
        currentAccountSeed.Parameters.AddWithValue("demo-user");
        currentAccountSeed.Parameters.AddWithValue("Demo Current Account");
        currentAccountSeed.Parameters.AddWithValue(1250m);
        currentAccountSeed.Parameters.AddWithValue(JsonSerializer.Serialize(new[]
        {
            new Payee { Id = "payee-landlord", Name = "Landlord - J. Smith", AccountNumber = "40205678", SortCode = "20-30-40" },
            new Payee { Id = "payee-electric", Name = "Electric Co.", AccountNumber = "11223344", SortCode = "10-20-30" }
        }));
        await currentAccountSeed.ExecuteNonQueryAsync(cancellationToken);
    }
}

public interface IBankRegistrationStore : IRegistrationStore
{
    Task RecordChallengeAsync(
        string challengeId,
        string accountId,
        string appUserId,
        DateTimeOffset createdAt,
        CancellationToken cancellationToken = default);
    Task<PendingBankRegistration?> ConsumeChallengeAsync(
        string challengeId,
        CancellationToken cancellationToken = default);
}

public sealed class PostgresRegistrationStore : IBankRegistrationStore
{
    private readonly NpgsqlDataSource _dataSource;
    public PostgresRegistrationStore(NpgsqlDataSource dataSource) => _dataSource = dataSource;

    public async Task StoreRegistrationAsync(RegistrationResponse response, CancellationToken cancellationToken = default)
    {
        if (!await HasPendingChallengeAsync(response.ChallengeId, cancellationToken))
            throw new InvalidOperationException("Registration callback does not match a pending challenge.");

        await using var command = _dataSource.CreateCommand("""
            insert into bank.registrations (registration_id, challenge_id, resolver_base_url, user_id, access_token, created_at)
            values ($1, $2, $3, $4, $5, $6)
            on conflict (registration_id) do update set access_token = excluded.access_token, created_at = excluded.created_at;
            """);
        command.Parameters.AddWithValue(response.RegistrationId); command.Parameters.AddWithValue(response.ChallengeId); command.Parameters.AddWithValue(response.ResolverBaseUrl); command.Parameters.AddWithValue(response.UserId); command.Parameters.AddWithValue(response.AccessToken); command.Parameters.AddWithValue(response.CreatedAt);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<bool> HasPendingChallengeAsync(
        string challengeId,
        CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand(
            "select exists(select 1 from bank.pending_challenges where challenge_id = $1)");
        command.Parameters.AddWithValue(challengeId);
        return (bool)(await command.ExecuteScalarAsync(cancellationToken) ?? false);
    }

    public async Task RecordChallengeAsync(
        string challengeId,
        string accountId,
        string appUserId,
        DateTimeOffset createdAt,
        CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("""
            insert into bank.pending_challenges (challenge_id, account_id, app_user_id, created_at)
            values ($1, $2, $3, $4)
            on conflict (challenge_id) do update set
                account_id = excluded.account_id,
                app_user_id = excluded.app_user_id,
                created_at = excluded.created_at;
            """);
        command.Parameters.AddWithValue(challengeId);
        command.Parameters.AddWithValue(accountId);
        command.Parameters.AddWithValue(appUserId);
        command.Parameters.AddWithValue(createdAt);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<PendingBankRegistration?> ConsumeChallengeAsync(
        string challengeId,
        CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("""
            delete from bank.pending_challenges
            where challenge_id = $1
            returning account_id, app_user_id;
            """);
        command.Parameters.AddWithValue(challengeId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? new PendingBankRegistration(reader.GetString(0), reader.GetString(1))
            : null;
    }

    public async Task<RegistrationResponse?> GetRegistrationAsync(string userId, string resolverBaseUrl, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("select challenge_id, resolver_base_url, user_id, access_token, registration_id, created_at from bank.registrations where user_id = $1 and resolver_base_url = $2 order by created_at desc limit 1"); command.Parameters.AddWithValue(userId); command.Parameters.AddWithValue(resolverBaseUrl);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? Read(reader) : null;
    }

    public async Task<IReadOnlyList<RegistrationResponse>> GetAllRegistrationsAsync(CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("select challenge_id, resolver_base_url, user_id, access_token, registration_id, created_at from bank.registrations order by created_at desc"); await using var reader = await command.ExecuteReaderAsync(cancellationToken); var results = new List<RegistrationResponse>();
        while (await reader.ReadAsync(cancellationToken)) results.Add(Read(reader));
        return results;
    }

    private static RegistrationResponse Read(NpgsqlDataReader reader) => new() { ChallengeId = reader.GetString(0), ResolverBaseUrl = reader.GetString(1), UserId = reader.GetString(2), AccessToken = reader.GetString(3), RegistrationId = reader.GetString(4), CreatedAt = reader.GetFieldValue<DateTimeOffset>(5) };
}

public sealed record PendingBankRegistration(string AccountId, string AppUserId);

public sealed class PostgresAccountStore : IAccountStore
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresAccountStore(NpgsqlDataSource dataSource) => _dataSource = dataSource;

    public async Task<Account?> GetByIdAsync(string accountId, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("select id, owner_user_id, name, balance, payees, resolver_url, access_token, user_id from bank.accounts where id = $1");
        command.Parameters.AddWithValue(accountId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadAccount(reader) : null;
    }

    public async Task SaveAsync(Account account, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("""
            insert into bank.accounts (id, owner_user_id, name, balance, payees, resolver_url, access_token, user_id)
            values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
            on conflict (id) do update set name = excluded.name, balance = excluded.balance,
                payees = excluded.payees, resolver_url = excluded.resolver_url,
                access_token = excluded.access_token, user_id = excluded.user_id
            where bank.accounts.owner_user_id = excluded.owner_user_id;
            """);
        AddAccountParameters(command, account);
        if (await command.ExecuteNonQueryAsync(cancellationToken) != 1)
            throw new InvalidOperationException("Account ownership cannot be changed by a save operation.");
    }

    public async Task<IReadOnlyList<Account>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("select id, owner_user_id, name, balance, payees, resolver_url, access_token, user_id from bank.accounts order by id");
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var accounts = new List<Account>();
        while (await reader.ReadAsync(cancellationToken)) accounts.Add(ReadAccount(reader));
        return accounts;
    }

    private static void AddAccountParameters(NpgsqlCommand command, Account account)
    {
        command.Parameters.AddWithValue(account.Id);
        command.Parameters.AddWithValue(account.OwnerUserId);
        command.Parameters.AddWithValue(account.Name);
        command.Parameters.AddWithValue(account.Balance);
        command.Parameters.AddWithValue(JsonSerializer.Serialize(account.Payees));
        command.Parameters.AddWithValue((object?)account.OhppRegistration?.ResolverUrl ?? DBNull.Value);
        command.Parameters.AddWithValue((object?)account.OhppRegistration?.AccessToken ?? DBNull.Value);
        command.Parameters.AddWithValue((object?)account.OhppRegistration?.UserId ?? DBNull.Value);
    }

    private static Account ReadAccount(NpgsqlDataReader reader) => new()
    {
        Id = reader.GetString(0),
        OwnerUserId = reader.GetString(1),
        Name = reader.GetString(2),
        Balance = reader.GetDecimal(3),
        Payees = JsonSerializer.Deserialize<List<Payee>>(reader.GetString(4), new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new(),
        OhppRegistration = reader.IsDBNull(5) ? null : new OhppRegistration
        {
            ResolverUrl = reader.GetString(5),
            AccessToken = reader.GetString(6),
            UserId = reader.GetString(7)
        }
    };
}

public sealed class PostgresTransactionStore : ITransactionStore
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresTransactionStore(NpgsqlDataSource dataSource) => _dataSource = dataSource;

    public async Task RecordAsync(TransactionRecord record, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("""
            insert into bank.transactions (id, account_id, payee_name, amount, reference, status, participation_request_id, created_at, resolved_at, scheduled_for)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            on conflict (id) do update set status = excluded.status, resolved_at = excluded.resolved_at;
            """);
        command.Parameters.AddWithValue(record.Id);
        command.Parameters.AddWithValue(record.AccountId);
        command.Parameters.AddWithValue(record.PayeeName);
        command.Parameters.AddWithValue(record.Amount);
        command.Parameters.AddWithValue((object?)record.Reference ?? DBNull.Value);
        command.Parameters.AddWithValue(record.Status.ToString());
        command.Parameters.AddWithValue((object?)record.ParticipationRequestId ?? DBNull.Value);
        command.Parameters.AddWithValue(record.CreatedAt);
        command.Parameters.AddWithValue((object?)record.ResolvedAt ?? DBNull.Value);
        command.Parameters.AddWithValue((object?)record.ScheduledFor ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> TryResolveAsync(
        string id,
        TransferStatus status,
        DateTimeOffset resolvedAt,
        CancellationToken cancellationToken = default)
    {
        var sql = status == TransferStatus.Completed
            ? """
              with transitioned as (
                  update bank.transactions
                  set status = $1, resolved_at = $2
                  where id = $3 and status = 'PendingApproval'
                  returning account_id, amount
              )
              update bank.accounts as account
              set balance = account.balance - transitioned.amount
              from transitioned
              where account.id = transitioned.account_id;
              """
            : """
              update bank.transactions
              set status = $1, resolved_at = $2
              where id = $3 and status = 'PendingApproval';
              """;
        await using var command = _dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue(status.ToString());
        command.Parameters.AddWithValue(resolvedAt);
        command.Parameters.AddWithValue(id);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public Task<TransactionRecord?> GetByParticipationRequestIdAsync(string requestId, CancellationToken cancellationToken = default) => GetOneAsync("participation_request_id", requestId, cancellationToken);

    public async Task<int> ExecuteDueScheduledAsync(
        string accountId,
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("""
            with due as (
                select coalesce(sum(amount), 0) as total
                from bank.transactions
                where account_id = $1 and status = 'Scheduled' and scheduled_for <= $2
            ), debited as (
                update bank.accounts
                set balance = balance - due.total
                from due
                where id = $1 and due.total > 0 and balance >= due.total
                returning id
            )
            update bank.transactions
            set status = 'Completed', resolved_at = $2
            where account_id = $1 and status = 'Scheduled' and scheduled_for <= $2
                and exists (select 1 from debited);
            """);
        command.Parameters.AddWithValue(accountId);
        command.Parameters.AddWithValue(now);
        return await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TransactionRecord>> GetByAccountIdAsync(string accountId, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("select id, account_id, payee_name, amount, reference, status, participation_request_id, created_at, resolved_at, scheduled_for from bank.transactions where account_id = $1 order by created_at desc");
        command.Parameters.AddWithValue(accountId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var records = new List<TransactionRecord>();
        while (await reader.ReadAsync(cancellationToken)) records.Add(ReadRecord(reader));
        return records;
    }

    private async Task<TransactionRecord?> GetOneAsync(string field, string value, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand($"select id, account_id, payee_name, amount, reference, status, participation_request_id, created_at, resolved_at, scheduled_for from bank.transactions where {field} = $1 limit 1");
        command.Parameters.AddWithValue(value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadRecord(reader) : null;
    }

    private static TransactionRecord ReadRecord(NpgsqlDataReader reader) => new()
    {
        Id = reader.GetString(0), AccountId = reader.GetString(1), PayeeName = reader.GetString(2), Amount = reader.GetDecimal(3),
        Reference = reader.IsDBNull(4) ? null : reader.GetString(4), Status = Enum.Parse<TransferStatus>(reader.GetString(5)),
        ParticipationRequestId = reader.IsDBNull(6) ? null : reader.GetString(6), CreatedAt = reader.GetFieldValue<DateTimeOffset>(7),
        ResolvedAt = reader.IsDBNull(8) ? null : reader.GetFieldValue<DateTimeOffset>(8),
        ScheduledFor = reader.IsDBNull(9) ? null : reader.GetFieldValue<DateTimeOffset>(9)
    };
}
