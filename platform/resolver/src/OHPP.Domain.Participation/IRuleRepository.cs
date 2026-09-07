namespace OHPP.Domain.Participation;

public interface IRuleRepository
{
    Task<IReadOnlyList<ParticipationRule>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<ParticipationRule?> GetByIdAsync(Guid ruleId, CancellationToken cancellationToken = default);
    Task<ParticipationRule> CreateAsync(ParticipationRule rule, CancellationToken cancellationToken = default);
    Task UpdateAsync(ParticipationRule rule, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid ruleId, CancellationToken cancellationToken = default);
    Task ReorderAsync(Guid userId, IReadOnlyList<Guid> ruleIdsInOrder, CancellationToken cancellationToken = default);
}
