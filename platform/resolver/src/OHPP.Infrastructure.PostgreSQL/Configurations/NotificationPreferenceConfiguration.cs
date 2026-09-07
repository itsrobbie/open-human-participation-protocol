using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.PostgreSQL.Configurations;

internal sealed class NotificationPreferenceConfiguration : IEntityTypeConfiguration<NotificationPreference>
{
    public void Configure(EntityTypeBuilder<NotificationPreference> builder)
    {
        builder.ToTable("notification_preferences");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.AppId)
            .IsRequired()
            .HasMaxLength(256);

        builder.HasIndex(n => new { n.UserId, n.AppId })
            .IsUnique();
    }
}
