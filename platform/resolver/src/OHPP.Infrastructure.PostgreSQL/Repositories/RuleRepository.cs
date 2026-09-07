using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.PostgreSQL.Repositories;

public sealed class RuleRepository : IRuleRepository
{
    private readonly AppDbContext _db;

    public RuleRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<ParticipationRule>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _db.ParticipationRules
            .Include(r => r.Conditions)
            .Where(r => r.UserId == userId)
            .OrderBy(r => r.Priority)
            .ToListAsync(cancellationToken);
    }

    public async Task<ParticipationRule?> GetByIdAsync(Guid ruleId, CancellationToken cancellationToken = default)
    {
        return await _db.ParticipationRules
            .Include(r => r.Conditions)
            .FirstOrDefaultAsync(r => r.Id == ruleId, cancellationToken);
    }

    public async Task<ParticipationRule> CreateAsync(ParticipationRule rule, CancellationToken cancellationToken = default)
    {
        _db.ParticipationRules.Add(rule);
        await _db.SaveChangesAsync(cancellationToken);
        return rule;
    }

    public async Task UpdateAsync(ParticipationRule rule, CancellationToken cancellationToken = default)
    {
        // Clear the change tracker to avoid conflicts
        _db.ChangeTracker.Clear();

        // Remove existing conditions directly
        var existingConditions = await _db.RuleConditions
            .Where(c => c.RuleId == rule.Id)
            .ToListAsync(cancellationToken);
        _db.RuleConditions.RemoveRange(existingConditions);
        await _db.SaveChangesAsync(cancellationToken);

        // Now update the rule itself (detached state, re-attach as modified)
        _db.ChangeTracker.Clear();
        _db.ParticipationRules.Attach(rule);
        _db.Entry(rule).State = EntityState.Modified;

        // Add new conditions
        foreach (var condition in rule.Conditions)
        {
            _db.RuleConditions.Add(condition);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid ruleId, CancellationToken cancellationToken = default)
    {
        var rule = await _db.ParticipationRules
            .Include(r => r.Conditions)
            .FirstOrDefaultAsync(r => r.Id == ruleId, cancellationToken);

        if (rule is not null)
        {
            _db.RuleConditions.RemoveRange(rule.Conditions);
            _db.ParticipationRules.Remove(rule);
            await _db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task ReorderAsync(Guid userId, IReadOnlyList<Guid> ruleIdsInOrder, CancellationToken cancellationToken = default)
    {
        var rules = await _db.ParticipationRules
            .Where(r => r.UserId == userId)
            .ToListAsync(cancellationToken);

        for (var i = 0; i < ruleIdsInOrder.Count; i++)
        {
            var rule = rules.FirstOrDefault(r => r.Id == ruleIdsInOrder[i]);
            if (rule is not null)
            {
                rule.Priority = i + 1;
                rule.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
    }
}
