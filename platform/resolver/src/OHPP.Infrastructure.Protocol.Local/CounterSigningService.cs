using System.Text.Json;
using OHPP.Domain.Attestation;
using OHPP.Domain.Shared;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;

namespace OHPP.Infrastructure.Protocol.Local;

public sealed class CounterSigningService : ICounterSigningService
{
    private readonly IKeyStore _keyStore;
    private readonly ISigner _signer;
    private readonly IKeyEncryptor _keyEncryptor;
    private readonly IClock _clock;

    public CounterSigningService(
        IKeyStore keyStore,
        ISigner signer,
        IKeyEncryptor keyEncryptor,
        IClock clock)
    {
        _keyStore = keyStore;
        _signer = signer;
        _keyEncryptor = keyEncryptor;
        _clock = clock;
    }

    public async Task<Result<string>> CounterSignAsync(
        string innerAttestationJson,
        string deviceSignature,
        string deviceKeyId,
        CancellationToken cancellationToken = default)
    {
        var activeKey = await _keyStore.GetActiveKeyAsync(cancellationToken);
        if (activeKey is null)
        {
            return Error.ServiceUnavailable("No active resolver signing key available");
        }

        var decryptedPrivateKey = _keyEncryptor.Decrypt(activeKey.PrivateKeyPem);

        var innerAttestation = BuildInnerAttestation(
            innerAttestationJson,
            deviceSignature,
            deviceKeyId);
        var canonicalInnerAttestation = OhppJsonSerialiser.SerialiseCanonical(innerAttestation);
        var resolverSignature = _signer.Sign(canonicalInnerAttestation, decryptedPrivateKey);

        var signedEnvelope = new AttestationEnvelope
        {
            InnerAttestation = innerAttestation,
            OuterSignature = new SignatureInfo
            {
                Algorithm = ParseAlgorithm(activeKey.Algorithm),
                Value = resolverSignature,
                KeyId = activeKey.KeyId
            },
            IssuedAt = _clock.UtcNow
        };

        return OhppJsonSerialiser.Serialise(signedEnvelope);
    }

    private ParticipationAttestation BuildInnerAttestation(
        string innerAttestationJson,
        string deviceSignature,
        string deviceKeyId)
    {
        using var document = JsonDocument.Parse(innerAttestationJson);
        var root = document.RootElement;
        var requestId = GetString(root, "requestId") ?? Guid.NewGuid().ToString();
        var decisionTimestamp = DateTimeOffset.TryParse(
            GetString(root, "decisionTimestamp"),
            out var parsedTimestamp)
            ? parsedTimestamp
            : _clock.UtcNow;
        var selectedOption = GetString(root, "selectedOption") ?? GetString(root, "decision");
        var selectedOptions = root.TryGetProperty("selectedOptions", out var selectedOptionsElement) &&
                              selectedOptionsElement.ValueKind == JsonValueKind.Array
            ? selectedOptionsElement.EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.String)
                .Select(item => item.GetString()!)
                .ToArray()
            : null;
        var method = GetString(root, "method");

        return new ParticipationAttestation
        {
            Id = Guid.NewGuid().ToString(),
            RequestId = requestId,
            Version = "1.0",
            Decision = new DecisionInfo
            {
                SelectedOption = selectedOption,
                SelectedOptions = selectedOptions,
                Value = GetString(root, "value"),
                Timestamp = decisionTimestamp
            },
            Resolution = new ResolutionInfo
            {
                Method = method switch
                {
                    "AutoApproved" => ResolutionMethod.AutoApproved,
                    "Delegated" => ResolutionMethod.Delegated,
                    _ => ResolutionMethod.Direct
                },
                Endpoint = new EndpointInfo
                {
                    Type = deviceKeyId.StartsWith("web:", StringComparison.Ordinal)
                        ? "browser"
                        : "device",
                    Id = deviceKeyId
                },
                DelegatedTo = GetString(root, "delegatedTo")
            },
            Signature = new SignatureInfo
            {
                Algorithm = SignatureAlgorithm.ES256,
                Value = deviceSignature,
                KeyId = deviceKeyId
            },
            IssuedAt = decisionTimestamp
        };
    }

    private static string? GetString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static SignatureAlgorithm ParseAlgorithm(string algorithm) =>
        string.Equals(algorithm, "EdDSA", StringComparison.Ordinal)
            ? SignatureAlgorithm.EdDSA
            : SignatureAlgorithm.ES256;
}
