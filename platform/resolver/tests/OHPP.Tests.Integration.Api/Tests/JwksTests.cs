using System.Net;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OHPP.Domain.Attestation;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class JwksTests : IntegrationTestBase
{
    public JwksTests(TestWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task JwksEndpoint_ReturnsKeysArray()
    {
        var response = await Client.GetAsync("/.well-known/ohpp/keys");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("keys");
    }

    [Fact]
    public async Task JwksEndpoint_IncludesRetiredKeys()
    {
        // Seed an active and a retired key
        using var scope = Factory.Services.CreateScope();
        var keyStore = scope.ServiceProvider.GetRequiredService<IKeyStore>();

        await keyStore.CreateKeyAsync(new SigningKey
        {
            KeyId = "key_active_jwks",
            Algorithm = "ES256",
            PublicKeyPem = "-----BEGIN PUBLIC KEY-----\nactive\n-----END PUBLIC KEY-----",
            PrivateKeyPem = "-----BEGIN EC PRIVATE KEY-----\nenc\n-----END EC PRIVATE KEY-----",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow
        });

        await keyStore.CreateKeyAsync(new SigningKey
        {
            KeyId = "key_retired_jwks",
            Algorithm = "ES256",
            PublicKeyPem = "-----BEGIN PUBLIC KEY-----\nretired\n-----END PUBLIC KEY-----",
            PrivateKeyPem = "-----BEGIN EC PRIVATE KEY-----\nenc\n-----END EC PRIVATE KEY-----",
            IsActive = false,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-30),
            RetiredAt = DateTimeOffset.UtcNow.AddDays(-1)
        });

        var response = await Client.GetAsync("/.well-known/ohpp/keys");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("key_active_jwks");
        body.Should().Contain("key_retired_jwks");
    }

    [Fact]
    public async Task MetadataEndpoint_ReturnsProtocolVersion()
    {
        var response = await Client.GetAsync("/.well-known/ohpp/metadata");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("protocolVersion");
        body.Should().Contain("\"name\"");
        body.Should().Contain("endpoints");
    }
}
