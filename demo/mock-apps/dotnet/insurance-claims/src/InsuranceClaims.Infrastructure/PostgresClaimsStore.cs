using System.Text.Json;
using System.Text.Json.Serialization;
using InsuranceClaims.Domain;
using Npgsql;
using OHPP.Protocol.Models;
using OHPP.Sdk;

namespace InsuranceClaims.Infrastructure;

internal static class ClaimsJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
    };

    static ClaimsJson() => Options.Converters.Add(new JsonStringEnumConverter());
}

public sealed class ClaimsDatabaseInitializer
{
    private readonly NpgsqlDataSource _dataSource;
    public ClaimsDatabaseInitializer(NpgsqlDataSource dataSource) => _dataSource = dataSource;

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("""
            create table if not exists insurance_claims.policies (id text primary key, user_id text not null, payload jsonb not null);
            create table if not exists insurance_claims.claims (id text primary key, user_id text not null, payload jsonb not null, updated_at timestamptz not null);
            create table if not exists insurance_claims.pending_challenges (challenge_id text primary key, app_user_id text not null, created_at timestamptz not null);
            create table if not exists insurance_claims.registrations (registration_id text primary key, challenge_id text not null, resolver_base_url text not null, user_id text not null, app_user_id text not null, access_token text not null, created_at timestamptz not null);
            alter table insurance_claims.registrations add column if not exists app_user_id text;
            update insurance_claims.registrations set app_user_id = user_id where app_user_id is null;
            alter table insurance_claims.registrations alter column app_user_id set not null;
            """);
        await command.ExecuteNonQueryAsync(cancellationToken);
        await using var seed = _dataSource.CreateCommand("""
            insert into insurance_claims.policies (id, user_id, payload)
            values ($1, $2, $3::jsonb) on conflict (id) do nothing;
            """);
        var policy = new InsurancePolicy { Id = "policy-1", PolicyNumber = "POL-0001", CustomerName = "Demo User", CoverageLimit = 10000m, ValidFrom = new DateOnly(2026, 1, 1), ValidTo = new DateOnly(2026, 12, 31), Status = PolicyStatus.Active };
        seed.Parameters.AddWithValue(policy.Id); seed.Parameters.AddWithValue("demo-user"); seed.Parameters.AddWithValue(JsonSerializer.Serialize(policy));
        await seed.ExecuteNonQueryAsync(cancellationToken);
    }
}

public sealed class PostgresClaimRepository : IClaimRepository
{
    private readonly NpgsqlDataSource _dataSource;
    public PostgresClaimRepository(NpgsqlDataSource dataSource) => _dataSource = dataSource;

    public async Task<InsuranceClaim?> GetAsync(string id, string userId, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("select payload from insurance_claims.claims where id = $1 and user_id = $2");
        command.Parameters.AddWithValue(id);
        command.Parameters.AddWithValue(userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? JsonSerializer.Deserialize<InsuranceClaim>(reader.GetString(0), ClaimsJson.Options) : null;
    }

    public async Task<IReadOnlyList<InsuranceClaim>> GetAllAsync(string userId, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("select payload from insurance_claims.claims where user_id = $1 order by updated_at desc"); command.Parameters.AddWithValue(userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken); var results = new List<InsuranceClaim>();
        while (await reader.ReadAsync(cancellationToken)) results.Add(JsonSerializer.Deserialize<InsuranceClaim>(reader.GetString(0), ClaimsJson.Options)!);
        return results;
    }

    public async Task SaveAsync(InsuranceClaim claim, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("""
            insert into insurance_claims.claims (id, user_id, payload, updated_at) values ($1, $2, $3::jsonb, $4)
            on conflict (id) do update set payload = excluded.payload, updated_at = excluded.updated_at
            where insurance_claims.claims.user_id = excluded.user_id;
            """);
        command.Parameters.AddWithValue(claim.Id); command.Parameters.AddWithValue(claim.UserId); command.Parameters.AddWithValue(JsonSerializer.Serialize(claim, ClaimsJson.Options)); command.Parameters.AddWithValue(claim.UpdatedAt);
        if (await command.ExecuteNonQueryAsync(cancellationToken) != 1)
            throw new InvalidOperationException("Claim ownership cannot be changed by a save operation.");
    }
}

public sealed class PostgresPolicyRepository : IPolicyRepository
{
    private readonly NpgsqlDataSource _dataSource;
    public PostgresPolicyRepository(NpgsqlDataSource dataSource) => _dataSource = dataSource;
    public async Task<InsurancePolicy?> GetAsync(string id, string userId, CancellationToken cancellationToken = default)
    { await using var command = _dataSource.CreateCommand("select payload from insurance_claims.policies where id = $1 and user_id = $2"); command.Parameters.AddWithValue(id); command.Parameters.AddWithValue(userId); await using var reader = await command.ExecuteReaderAsync(cancellationToken); return await reader.ReadAsync(cancellationToken) ? JsonSerializer.Deserialize<InsurancePolicy>(reader.GetString(0), ClaimsJson.Options) : null; }
    public async Task<IReadOnlyList<InsurancePolicy>> GetAllAsync(string userId, CancellationToken cancellationToken = default)
    { await using var command = _dataSource.CreateCommand("select payload from insurance_claims.policies where user_id = $1"); command.Parameters.AddWithValue(userId); await using var reader = await command.ExecuteReaderAsync(cancellationToken); var results = new List<InsurancePolicy>(); while (await reader.ReadAsync(cancellationToken)) results.Add(JsonSerializer.Deserialize<InsurancePolicy>(reader.GetString(0), ClaimsJson.Options)!); return results; }
}

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

public interface IInsuranceRegistrationStore : IRegistrationStore
{
    Task RecordChallengeAsync(string challengeId, string appUserId, DateTimeOffset createdAt, CancellationToken cancellationToken = default);
    Task<RegistrationResponse?> GetForAppUserAsync(string appUserId, CancellationToken cancellationToken = default);
    Task<bool> HasRegistrationAsync(string appUserId, CancellationToken cancellationToken = default);
    Task RevokeForAppUserAsync(string appUserId, CancellationToken cancellationToken = default);
}

public sealed class PostgresInsuranceRegistrationStore : IInsuranceRegistrationStore
{
    private readonly NpgsqlDataSource _dataSource;
    public PostgresInsuranceRegistrationStore(NpgsqlDataSource dataSource) => _dataSource = dataSource;

    public async Task RecordChallengeAsync(string challengeId, string appUserId, DateTimeOffset createdAt, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("""
            insert into insurance_claims.pending_challenges (challenge_id, app_user_id, created_at)
            values ($1, $2, $3)
            on conflict (challenge_id) do update set app_user_id = excluded.app_user_id, created_at = excluded.created_at;
            """);
        command.Parameters.AddWithValue(challengeId);
        command.Parameters.AddWithValue(appUserId);
        command.Parameters.AddWithValue(createdAt);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task StoreRegistrationAsync(RegistrationResponse response, CancellationToken cancellationToken = default)
    {
        var appUserId = await GetPendingAppUserIdAsync(response.ChallengeId, cancellationToken)
            ?? throw new InvalidOperationException("Registration callback does not match a pending challenge.");
        await using var command = _dataSource.CreateCommand("insert into insurance_claims.registrations (registration_id, challenge_id, resolver_base_url, user_id, app_user_id, access_token, created_at) values ($1,$2,$3,$4,$5,$6,$7) on conflict (registration_id) do update set app_user_id=excluded.app_user_id,access_token=excluded.access_token,created_at=excluded.created_at");
        command.Parameters.AddWithValue(response.RegistrationId); command.Parameters.AddWithValue(response.ChallengeId); command.Parameters.AddWithValue(response.ResolverBaseUrl); command.Parameters.AddWithValue(response.UserId); command.Parameters.AddWithValue(appUserId); command.Parameters.AddWithValue(response.AccessToken); command.Parameters.AddWithValue(response.CreatedAt); await command.ExecuteNonQueryAsync(cancellationToken);
    }
    public async Task<RegistrationResponse?> GetRegistrationAsync(string userId, string resolverBaseUrl, CancellationToken cancellationToken = default)
    { await using var command = _dataSource.CreateCommand("select challenge_id,resolver_base_url,user_id,access_token,registration_id,created_at from insurance_claims.registrations where user_id=$1 and resolver_base_url=$2 order by created_at desc limit 1"); command.Parameters.AddWithValue(userId); command.Parameters.AddWithValue(resolverBaseUrl); await using var reader = await command.ExecuteReaderAsync(cancellationToken); return await reader.ReadAsync(cancellationToken) ? ReadRegistration(reader) : null; }
    public async Task<IReadOnlyList<RegistrationResponse>> GetAllRegistrationsAsync(CancellationToken cancellationToken = default)
    { await using var command = _dataSource.CreateCommand("select challenge_id,resolver_base_url,user_id,access_token,registration_id,created_at from insurance_claims.registrations order by created_at desc"); await using var reader = await command.ExecuteReaderAsync(cancellationToken); var result = new List<RegistrationResponse>(); while (await reader.ReadAsync(cancellationToken)) result.Add(ReadRegistration(reader)); return result; }

    public async Task<RegistrationResponse?> GetForAppUserAsync(string appUserId, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("select challenge_id,resolver_base_url,user_id,access_token,registration_id,created_at from insurance_claims.registrations where app_user_id=$1 order by created_at desc limit 1");
        command.Parameters.AddWithValue(appUserId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadRegistration(reader) : null;
    }

    public async Task<bool> HasRegistrationAsync(string appUserId, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("select exists(select 1 from insurance_claims.registrations where app_user_id=$1)");
        command.Parameters.AddWithValue(appUserId);
        return (bool)(await command.ExecuteScalarAsync(cancellationToken) ?? false);
    }

    public async Task RevokeForAppUserAsync(string appUserId, CancellationToken cancellationToken = default)
    {
        await using var command = _dataSource.CreateCommand("delete from insurance_claims.registrations where app_user_id=$1");
        command.Parameters.AddWithValue(appUserId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<string?> GetPendingAppUserIdAsync(string challengeId, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand("select app_user_id from insurance_claims.pending_challenges where challenge_id=$1");
        command.Parameters.AddWithValue(challengeId);
        return await command.ExecuteScalarAsync(cancellationToken) as string;
    }

    private static RegistrationResponse ReadRegistration(NpgsqlDataReader reader) => new() { ChallengeId=reader.GetString(0), ResolverBaseUrl=reader.GetString(1), UserId=reader.GetString(2), AccessToken=reader.GetString(3), RegistrationId=reader.GetString(4), CreatedAt=reader.GetFieldValue<DateTimeOffset>(5) };
}
