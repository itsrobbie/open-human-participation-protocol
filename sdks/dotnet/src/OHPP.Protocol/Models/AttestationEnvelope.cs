namespace OHPP.Protocol.Models;

/// <summary>
/// Nested attestation envelope containing device signature (inner) and Resolver signature (outer).
/// Requesters verify the outer signature against the Resolver's JWKS.
/// The inner signature is preserved for audit/transparency.
/// </summary>
public sealed class AttestationEnvelope
{
    public required ParticipationAttestation InnerAttestation { get; init; }
    public required SignatureInfo OuterSignature { get; init; }
    public required DateTimeOffset IssuedAt { get; init; }
}
