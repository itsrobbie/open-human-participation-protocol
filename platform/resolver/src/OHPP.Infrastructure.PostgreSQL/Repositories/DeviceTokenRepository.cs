using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Auth;

namespace OHPP.Infrastructure.PostgreSQL.Repositories;

public sealed class DeviceTokenRepository : IDeviceTokenRepository
{
    private readonly AppDbContext _db;

    public DeviceTokenRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Device?> GetByIdAsync(Guid deviceId, CancellationToken cancellationToken = default)
    {
        return await _db.Devices.FindAsync(new object[] { deviceId }, cancellationToken);
    }

    public async Task<Device?> GetByTokenAsync(string deviceToken, CancellationToken cancellationToken = default)
    {
        return await _db.Devices
            .FirstOrDefaultAsync(d => d.DeviceToken == deviceToken, cancellationToken);
    }

    public async Task<Device?> GetByUserAndDeviceIdentifierAsync(Guid userId, string deviceIdentifier, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(deviceIdentifier))
            return null;

        return await _db.Devices
            .FirstOrDefaultAsync(
                d => d.UserId == userId && d.DeviceIdentifier == deviceIdentifier,
                cancellationToken);
    }

    public async Task<IReadOnlyList<Device>> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _db.Devices
            .Where(d => d.UserId == userId && d.IsActive)
            .ToListAsync(cancellationToken);
    }

    public async Task<Device> CreateAsync(Device device, CancellationToken cancellationToken = default)
    {
        _db.Devices.Add(device);
        await _db.SaveChangesAsync(cancellationToken);
        return device;
    }

    public async Task UpdateAsync(Device device, CancellationToken cancellationToken = default)
    {
        _db.Devices.Update(device);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Device>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _db.Devices
            .Where(d => d.UserId == userId)
            .ToListAsync(cancellationToken);
    }
}
