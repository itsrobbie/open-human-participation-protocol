namespace OHPP.Domain.Registration;

public interface IAppRegistrationRepository
{
    Task<AppRegistration?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<AppRegistration?> GetActiveByUserAndAppIdAsync(Guid userId, string appId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AppRegistration>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<AppRegistration> CreateAsync(AppRegistration registration, CancellationToken cancellationToken = default);
    Task UpdateAsync(AppRegistration registration, CancellationToken cancellationToken = default);
}
