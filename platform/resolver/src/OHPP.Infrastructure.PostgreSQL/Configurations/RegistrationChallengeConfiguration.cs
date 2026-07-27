using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OHPP.Domain.Registration;

namespace OHPP.Infrastructure.PostgreSQL.Configurations;

internal sealed class RegistrationChallengeConfiguration : IEntityTypeConfiguration<RegistrationChallengeRecord>
{
    public void Configure(EntityTypeBuilder<RegistrationChallengeRecord> builder)
    {
        builder.ToTable("registration_challenges");

        builder.HasKey(c => c.ChallengeId);

        builder.Property(c => c.ChallengeId)
            .HasMaxLength(128);

        builder.Property(c => c.RequesterAppId)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(c => c.AppName)
            .HasMaxLength(256);

        builder.Property(c => c.AppIcon)
            .HasMaxLength(2048);

        builder.Property(c => c.CallbackPath)
            .HasMaxLength(2048);

        builder.HasIndex(c => new { c.UserId, c.IsCompleted });
    }
}
