using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OHPP.Domain.Attestation;

namespace OHPP.Infrastructure.PostgreSQL.Configurations;

internal sealed class SigningKeyConfiguration : IEntityTypeConfiguration<SigningKey>
{
    public void Configure(EntityTypeBuilder<SigningKey> builder)
    {
        builder.ToTable("signing_keys");

        builder.HasKey(k => k.KeyId);

        builder.Property(k => k.KeyId)
            .HasMaxLength(128);

        builder.Property(k => k.Algorithm)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(k => k.PublicKeyPem)
            .IsRequired();

        builder.Property(k => k.PrivateKeyPem)
            .IsRequired();

        builder.HasIndex(k => k.IsActive);
    }
}
