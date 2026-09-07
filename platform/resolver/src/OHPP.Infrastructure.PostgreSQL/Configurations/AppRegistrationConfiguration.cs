using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OHPP.Domain.Registration;

namespace OHPP.Infrastructure.PostgreSQL.Configurations;

internal sealed class AppRegistrationConfiguration : IEntityTypeConfiguration<AppRegistration>
{
    public void Configure(EntityTypeBuilder<AppRegistration> builder)
    {
        builder.ToTable("app_registrations");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.AppId)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(r => r.AppName)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(r => r.AppIcon)
            .HasMaxLength(2048);

        builder.Property(r => r.AccessToken)
            .IsRequired()
            .HasMaxLength(512);

        builder.Property(r => r.ResolverBaseUrl)
            .IsRequired()
            .HasMaxLength(2048);

        builder.HasIndex(r => r.AccessToken)
            .IsUnique();

        builder.HasIndex(r => new { r.UserId, r.AppId, r.RevokedAt });

        // Natural key: at most one ACTIVE registration per (user, app). Partial
        // so revoked rows (history) don't collide. Enforces the update-in-place
        // ceremony behaviour at the database level.
        builder.HasIndex(r => new { r.UserId, r.AppId })
            .IsUnique()
            .HasFilter("\"RevokedAt\" IS NULL");

        builder.Ignore(r => r.IsActive);
    }
}
