using Microsoft.EntityFrameworkCore;
using OHPP.Domain.Auth;
using OHPP.Domain.Attestation;
using OHPP.Domain.Participation;
using OHPP.Domain.Registration;

namespace OHPP.Infrastructure.PostgreSQL;

public sealed class AppDbContext : DbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<AppRegistration> AppRegistrations => Set<AppRegistration>();
    public DbSet<RegistrationChallengeRecord> RegistrationChallenges => Set<RegistrationChallengeRecord>();
    public DbSet<PendingRequest> PendingRequests => Set<PendingRequest>();
    public DbSet<ParticipationRecord> ParticipationRecords => Set<ParticipationRecord>();
    public DbSet<SigningKey> SigningKeys => Set<SigningKey>();

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
