using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.PostgreSQL.Configurations;

internal sealed class ParticipationRuleConfiguration : IEntityTypeConfiguration<ParticipationRule>
{
    public void Configure(EntityTypeBuilder<ParticipationRule> builder)
    {
        builder.ToTable("participation_rules");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Name)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(r => r.AppId)
            .HasMaxLength(256);

        builder.Property(r => r.AuthLevel)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(r => r.AutoRespondOption)
            .HasMaxLength(256);

        builder.Property(r => r.AutoRespondValue)
            .HasMaxLength(2048);

        builder.HasIndex(r => new { r.UserId, r.Priority });

        builder.HasMany(r => r.Conditions)
            .WithOne()
            .HasForeignKey(c => c.RuleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class RuleConditionConfiguration : IEntityTypeConfiguration<RuleCondition>
{
    public void Configure(EntityTypeBuilder<RuleCondition> builder)
    {
        builder.ToTable("rule_conditions");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Field)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(c => c.Operator)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(c => c.Value)
            .IsRequired()
            .HasMaxLength(2048);

        builder.HasIndex(c => c.RuleId);
    }
}
