using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.PostgreSQL.Configurations;

internal sealed class ParticipationRecordConfiguration : IEntityTypeConfiguration<ParticipationRecord>
{
    public void Configure(EntityTypeBuilder<ParticipationRecord> builder)
    {
        builder.ToTable("participation_records");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Status)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(r => r.AppId)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(r => r.AppName)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(r => r.ActionSummary)
            .IsRequired()
            .HasMaxLength(512);

        builder.Property(r => r.Type)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(r => r.Category)
            .HasMaxLength(128);

        builder.Property(r => r.DecisionPayload);

        builder.Property(r => r.AttestationPayload);

        builder.Property(r => r.ResolutionMethod)
            .HasMaxLength(32);

        builder.HasIndex(r => r.RequestId)
            .IsUnique();

        builder.HasIndex(r => new { r.UserId, r.CreatedAt });
    }
}
