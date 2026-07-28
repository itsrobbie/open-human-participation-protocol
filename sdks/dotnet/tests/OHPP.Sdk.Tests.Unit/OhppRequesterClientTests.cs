using System.Net;
using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;
using Xunit;

namespace OHPP.Sdk.Tests.Unit;

public sealed class OhppRequesterClientTests
{
    private static readonly string ResolverBaseUrl = "https://resolver.test";

    private static ServiceMetadata CreateMetadata() => new()
    {
        Name = "Test Resolver",
        ProtocolVersion = new ProtocolVersionRange { Min = "1.0", Max = "1.0" },
        Endpoints = new ServiceEndpoints
        {
            Participate = $"{ResolverBaseUrl}/api/participate",
            ParticipateStatus = $"{ResolverBaseUrl}/api/participate/{{requestId}}/status",
            Keys = $"{ResolverBaseUrl}/.well-known/ohpp/keys"
        }
    };

    [Fact]
    public async Task VerifyAttestation_ValidSignature_ReturnsTrue()
    {
        // Generate a real EC key pair
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var parameters = ecdsa.ExportParameters(false);

        var keyId = "test-key-1";
        var xBase64Url = Base64UrlEncode(parameters.Q.X!);
        var yBase64Url = Base64UrlEncode(parameters.Q.Y!);

        // Create an inner attestation and sign it with the key
        var innerAttestation = new ParticipationAttestation
        {
            Id = "att-123",
            RequestId = "req-456",
            Version = "1.0",
            Decision = new DecisionInfo
            {
                SelectedOption = "confirm",
                Timestamp = DateTimeOffset.UtcNow
            },
            Resolution = new ResolutionInfo
            {
                Method = ResolutionMethod.Direct,
                Endpoint = new EndpointInfo { Type = "device", Id = "dev-1" }
            },
            Signature = new SignatureInfo
            {
                Algorithm = SignatureAlgorithm.ES256,
                Value = "device-sig-placeholder",
                KeyId = "device-key-1"
            },
            IssuedAt = DateTimeOffset.UtcNow
        };

        // Produce the outer signature over the canonical inner attestation
        var payload = OhppJsonSerialiser.SerialiseCanonical(innerAttestation);
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var signatureBytes = ecdsa.SignData(payloadBytes, HashAlgorithmName.SHA256);
        var signatureBase64Url = Base64UrlEncode(signatureBytes);

        var envelope = new AttestationEnvelope
        {
            InnerAttestation = innerAttestation,
            OuterSignature = new SignatureInfo
            {
                Algorithm = SignatureAlgorithm.ES256,
                Value = signatureBase64Url,
                KeyId = keyId
            },
            IssuedAt = DateTimeOffset.UtcNow
        };

        // Set up the fake HTTP responses: metadata + JWKS
        var metadataJson = OhppJsonSerialiser.Serialise(CreateMetadata());
        var jwks = new JwkSet
        {
            Keys = new[]
            {
                new Jwk
                {
                    Kty = "EC",
                    Kid = keyId,
                    Alg = "ES256",
                    Use = "sig",
                    Crv = "P-256",
                    X = xBase64Url,
                    Y = yBase64Url
                }
            }
        };
        var jwksJson = OhppJsonSerialiser.Serialise(jwks);

        var handler = new MultiResponseHandler(new Dictionary<string, (string body, HttpStatusCode status)>
        {
            ["/.well-known/ohpp/metadata"] = (metadataJson, HttpStatusCode.OK),
            ["/.well-known/ohpp/keys"] = (jwksJson, HttpStatusCode.OK)
        });
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri(ResolverBaseUrl) };
        var discovery = new EndpointDiscovery(httpClient);
        var client = new OhppRequesterClient(httpClient, discovery);

        var result = await client.VerifyAttestationAsync(envelope, ResolverBaseUrl);

        result.Valid.Should().BeTrue();
        result.Error.Should().BeNull();
    }

    [Fact]
    public async Task VerifyAttestation_InvalidSignature_ReturnsFalse()
    {
        // Generate a key pair but use a different key to sign (simulating tampering)
        using var signingKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        using var differentKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var differentParams = differentKey.ExportParameters(false);

        var keyId = "test-key-2";
        var xBase64Url = Base64UrlEncode(differentParams.Q.X!);
        var yBase64Url = Base64UrlEncode(differentParams.Q.Y!);

        var innerAttestation = new ParticipationAttestation
        {
            Id = "att-789",
            RequestId = "req-012",
            Version = "1.0",
            Decision = new DecisionInfo
            {
                SelectedOption = "deny",
                Timestamp = DateTimeOffset.UtcNow
            },
            Resolution = new ResolutionInfo
            {
                Method = ResolutionMethod.Direct,
                Endpoint = new EndpointInfo { Type = "device", Id = "dev-2" }
            },
            Signature = new SignatureInfo
            {
                Algorithm = SignatureAlgorithm.ES256,
                Value = "device-sig",
                KeyId = "device-key-2"
            },
            IssuedAt = DateTimeOffset.UtcNow
        };

        // Sign with the SIGNING key but publish the DIFFERENT key in JWKS
        var payload = OhppJsonSerialiser.SerialiseCanonical(innerAttestation);
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var signatureBytes = signingKey.SignData(payloadBytes, HashAlgorithmName.SHA256);
        var signatureBase64Url = Base64UrlEncode(signatureBytes);

        var envelope = new AttestationEnvelope
        {
            InnerAttestation = innerAttestation,
            OuterSignature = new SignatureInfo
            {
                Algorithm = SignatureAlgorithm.ES256,
                Value = signatureBase64Url,
                KeyId = keyId
            },
            IssuedAt = DateTimeOffset.UtcNow
        };

        var metadataJson = OhppJsonSerialiser.Serialise(CreateMetadata());
        var jwks = new JwkSet
        {
            Keys = new[]
            {
                new Jwk
                {
                    Kty = "EC",
                    Kid = keyId,
                    Alg = "ES256",
                    Use = "sig",
                    Crv = "P-256",
                    X = xBase64Url,
                    Y = yBase64Url
                }
            }
        };
        var jwksJson = OhppJsonSerialiser.Serialise(jwks);

        var handler = new MultiResponseHandler(new Dictionary<string, (string body, HttpStatusCode status)>
        {
            ["/.well-known/ohpp/metadata"] = (metadataJson, HttpStatusCode.OK),
            ["/.well-known/ohpp/keys"] = (jwksJson, HttpStatusCode.OK)
        });
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri(ResolverBaseUrl) };
        var discovery = new EndpointDiscovery(httpClient);
        var client = new OhppRequesterClient(httpClient, discovery);

        var result = await client.VerifyAttestationAsync(envelope, ResolverBaseUrl);

        result.Valid.Should().BeFalse();
        result.Error.Should().Contain("verification failed");
    }

    [Fact]
    public async Task VerifyAttestation_UnknownKeyId_ReturnsFalse()
    {
        var innerAttestation = new ParticipationAttestation
        {
            Id = "att-999",
            RequestId = "req-999",
            Version = "1.0",
            Decision = new DecisionInfo { Timestamp = DateTimeOffset.UtcNow },
            Resolution = new ResolutionInfo
            {
                Method = ResolutionMethod.Direct,
                Endpoint = new EndpointInfo { Type = "device", Id = "dev-3" }
            },
            Signature = new SignatureInfo
            {
                Algorithm = SignatureAlgorithm.ES256,
                Value = "dev-sig",
                KeyId = "dev-key"
            },
            IssuedAt = DateTimeOffset.UtcNow
        };

        var envelope = new AttestationEnvelope
        {
            InnerAttestation = innerAttestation,
            OuterSignature = new SignatureInfo
            {
                Algorithm = SignatureAlgorithm.ES256,
                Value = "some-sig",
                KeyId = "unknown-key-id"
            },
            IssuedAt = DateTimeOffset.UtcNow
        };

        var metadataJson = OhppJsonSerialiser.Serialise(CreateMetadata());
        var jwks = new JwkSet { Keys = Array.Empty<Jwk>() }; // Empty JWKS — key not found
        var jwksJson = OhppJsonSerialiser.Serialise(jwks);

        var handler = new MultiResponseHandler(new Dictionary<string, (string body, HttpStatusCode status)>
        {
            ["/.well-known/ohpp/metadata"] = (metadataJson, HttpStatusCode.OK),
            ["/.well-known/ohpp/keys"] = (jwksJson, HttpStatusCode.OK)
        });
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri(ResolverBaseUrl) };
        var discovery = new EndpointDiscovery(httpClient);
        var client = new OhppRequesterClient(httpClient, discovery);

        var result = await client.VerifyAttestationAsync(envelope, ResolverBaseUrl);

        result.Valid.Should().BeFalse();
        result.Error.Should().Contain("unknown-key-id");
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private sealed class MultiResponseHandler : HttpMessageHandler
    {
        private readonly Dictionary<string, (string body, HttpStatusCode status)> _responses;

        public MultiResponseHandler(Dictionary<string, (string body, HttpStatusCode status)> responses)
        {
            _responses = responses;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.AbsolutePath;
            if (_responses.TryGetValue(path, out var response))
            {
                return Task.FromResult(new HttpResponseMessage(response.status)
                {
                    Content = new StringContent(response.body, Encoding.UTF8, "application/json")
                });
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }
    }
}
