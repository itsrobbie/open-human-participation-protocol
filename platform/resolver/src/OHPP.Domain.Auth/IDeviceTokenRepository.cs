namespace OHPP.Domain.Auth;

public interface IDeviceTokenRepository
{
    Task<Device?> GetByTokenAsync(string deviceToken, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Device>> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Device> CreateAsync(Device device, CancellationToken cancellationToken = default);
    Task UpdateAsync(Device device, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Device>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
