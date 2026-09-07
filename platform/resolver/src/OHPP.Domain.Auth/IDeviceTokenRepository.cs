namespace OHPP.Domain.Auth;

public interface IDeviceTokenRepository
{
    Task<Device?> GetByIdAsync(Guid deviceId, CancellationToken cancellationToken = default);
    Task<Device?> GetByTokenAsync(string deviceToken, CancellationToken cancellationToken = default);
    /// <summary>
    /// Look up a device by its natural key (owner + stable install identifier),
    /// used to make registration idempotent. Returns null if the identifier is
    /// empty or no matching device exists.
    /// </summary>
    Task<Device?> GetByUserAndDeviceIdentifierAsync(Guid userId, string deviceIdentifier, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Device>> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Device> CreateAsync(Device device, CancellationToken cancellationToken = default);
    Task UpdateAsync(Device device, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Device>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
