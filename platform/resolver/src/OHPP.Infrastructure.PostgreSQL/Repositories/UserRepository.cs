using Microsoft.EntityFrameworkCore;
using Npgsql;
using OHPP.Domain.Auth;

namespace OHPP.Infrastructure.PostgreSQL.Repositories;

public sealed class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;

    public UserRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<User?> GetByExternalIdAsync(string externalId, CancellationToken cancellationToken = default)
    {
        return await _db.Users
            .FirstOrDefaultAsync(u => u.ExternalId == externalId, cancellationToken);
    }

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _db.Users.FindAsync(new object[] { id }, cancellationToken);
    }

    public async Task<User> CreateAsync(User user, CancellationToken cancellationToken = default)
    {
        _db.Users.Add(user);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return user;
        }
        catch (DbUpdateException ex) when (IsDuplicateExternalId(ex))
        {
            // Race: a concurrent request created this user between our caller's
            // get-miss and this insert (first-touch auth fires on several pages
            // of a whole-case flow at once). The unique constraint on ExternalId
            // is the Resolver doing its job — recover idempotently by returning
            // the row the winning request inserted, rather than surfacing a 500
            // that cascades into a failed resolve/attestation downstream.
            _db.Entry(user).State = EntityState.Detached;
            var existing = await GetByExternalIdAsync(user.ExternalId, cancellationToken);
            if (existing is not null)
                return existing;
            throw;
        }
    }

    public async Task UpdateAsync(User user, CancellationToken cancellationToken = default)
    {
        _db.Users.Update(user);
        await _db.SaveChangesAsync(cancellationToken);
    }

    // True when the failure is a duplicate-key violation on the ExternalId
    // unique index (Postgres SQLSTATE 23505), i.e. the concurrent-create race.
    private static bool IsDuplicateExternalId(DbUpdateException ex)
        => ex.InnerException is PostgresException { SqlState: "23505" } pg
           && pg.ConstraintName == "IX_users_ExternalId";
}
