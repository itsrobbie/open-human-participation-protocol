using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Registration;

namespace OHPP.Infrastructure.PostgreSQL.Repositories;

public sealed class RegistrationChallengeStore : IRegistrationChallengeStore
{
    private readonly AppDbContext _db;

    public RegistrationChallengeStore(AppDbContext db)
    {
        _db = db;
    }

    public async Task StoreAsync(RegistrationChallengeRecord challenge, CancellationToken cancellationToken = default)
    {
        _db.RegistrationChallenges.Add(challenge);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<RegistrationChallengeRecord?> GetAsync(string challengeId, CancellationToken cancellationToken = default)
    {
        return await _db.RegistrationChallenges.FindAsync(new object[] { challengeId }, cancellationToken);
    }

    public async Task MarkCompletedAsync(string challengeId, CancellationToken cancellationToken = default)
    {
        var challenge = await _db.RegistrationChallenges.FindAsync(new object[] { challengeId }, cancellationToken);
        if (challenge is not null)
        {
            challenge.IsCompleted = true;
            await _db.SaveChangesAsync(cancellationToken);
        }
    }
}
