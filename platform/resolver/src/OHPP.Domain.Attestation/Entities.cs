namespace OHPP.Domain.Attestation;

public sealed class SigningKey
{
    public required string KeyId { get; set; }
    public required string Algorithm { get; set; }
    public required string PublicKeyPem { get; set; }
    public required string PrivateKeyPem { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? RetiredAt { get; set; }
}
