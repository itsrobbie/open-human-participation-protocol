using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.PostgreSQL.Configurations;

internal sealed class PendingRequestConfiguration : IEntityTypeConfiguration<PendingRequest>
{
    public void Configure(EntityTypeBuilder<PendingRequest> builder)
    {
        builder.ToTable("pending_requests");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Status)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(r => r.RequestPayload)
            .IsRequired();

        builder.Property(r => r.AppId)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(r => r.ActionSummary)
            .IsRequired()
            .HasMaxLength(512);

        builder.Property(r => r.Type)
            .IsRequired()
            .HasMaxLength(32);

        builder.HasIndex(r => new { r.UserId, r.Status });

        builder.HasIndex(r => new { r.AppRegistrationId, r.Status });

        builder.HasIndex(r => new { r.Status, r.ExpiresAt });
    }
}
