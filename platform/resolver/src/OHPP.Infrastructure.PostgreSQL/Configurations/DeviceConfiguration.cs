using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OHPP.Domain.Auth;

namespace OHPP.Infrastructure.PostgreSQL.Configurations;

internal sealed class DeviceConfiguration : IEntityTypeConfiguration<Device>
{
    public void Configure(EntityTypeBuilder<Device> builder)
    {
        builder.ToTable("devices");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Name)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(d => d.DeviceType)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(d => d.DeviceIdentifier)
            .HasMaxLength(256);

        builder.Property(d => d.PublicKey)
            .HasMaxLength(2048);

        builder.Property(d => d.KeyAlgorithm)
            .HasMaxLength(32);

        builder.Property(d => d.DeviceToken)
            .IsRequired()
            .HasMaxLength(512);

        builder.Property(d => d.PushToken)
            .HasMaxLength(512);

        builder.HasIndex(d => d.DeviceToken)
            .IsUnique();

        builder.HasIndex(d => new { d.UserId, d.IsActive });

        // Natural key: one device row per (user, install). Partial so legacy
        // rows without a DeviceIdentifier (NULL) are exempt.
        builder.HasIndex(d => new { d.UserId, d.DeviceIdentifier })
            .IsUnique()
            .HasFilter("\"DeviceIdentifier\" IS NOT NULL");
    }
}
