namespace OHPP.Domain.Shared;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
