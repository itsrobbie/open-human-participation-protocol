using OHPP.Domain.Shared;

namespace OHPP.Infrastructure.DotNet;

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
