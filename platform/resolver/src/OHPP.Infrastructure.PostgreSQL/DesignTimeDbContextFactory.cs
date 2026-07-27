using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace OHPP.Infrastructure.PostgreSQL;

/// <summary>
/// Used by EF Core tools (dotnet ef migrations) at design time.
/// Not used at runtime — the actual connection string comes from DI configuration.
/// Reads from OHPP_POSTGRES_CONNECTION environment variable, falling back to a local default.
/// </summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    private const string DefaultConnectionString =
        "Host=localhost;Database=ohpp_design_time;Username=postgres;Password=postgres";

    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("OHPP_POSTGRES_CONNECTION")
                               ?? DefaultConnectionString;

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new AppDbContext(options);
    }
}
