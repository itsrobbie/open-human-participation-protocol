using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Attestation;

namespace OHPP.Infrastructure.PostgreSQL.Repositories;

public sealed class KeyStoreRepository : IKeyStore
{
    private readonly AppDbContext _db;

    public KeyStoreRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<SigningKey?> GetActiveKeyAsync(CancellationToken cancellationToken = default)
    {
        return await _db.SigningKeys
            .FirstOrDefaultAsync(k => k.IsActive, cancellationToken);
    }

    public async Task<SigningKey?> GetByKeyIdAsync(string keyId, CancellationToken cancellationToken = default)
    {
        return await _db.SigningKeys.FindAsync(new object[] { keyId }, cancellationToken);
    }

    public async Task<IReadOnlyList<SigningKey>> GetAllKeysAsync(CancellationToken cancellationToken = default)
    {
        return await _db.SigningKeys.ToListAsync(cancellationToken);
    }

    public async Task<SigningKey> CreateKeyAsync(SigningKey key, CancellationToken cancellationToken = default)
    {
        _db.SigningKeys.Add(key);
        await _db.SaveChangesAsync(cancellationToken);
        return key;
    }

    public async Task RetireKeyAsync(string keyId, CancellationToken cancellationToken = default)
    {
        var key = await _db.SigningKeys.FindAsync(new object[] { keyId }, cancellationToken);
        if (key is not null)
        {
            key.IsActive = false;
            key.RetiredAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }
    }
}
