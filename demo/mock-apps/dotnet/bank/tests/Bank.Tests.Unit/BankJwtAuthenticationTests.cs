using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Bank.Domain;
using Bank.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using NSubstitute;
using Xunit;

namespace Bank.Tests.Unit;

public sealed class BankJwtAuthenticationTests : IClassFixture<BankJwtApiFactory>
{
    private readonly BankJwtApiFactory _factory;

    public BankJwtAuthenticationTests(BankJwtApiFactory factory) => _factory = factory;

    [Fact]
    public async Task BankAuth_ValidBankRealmToken_IsAccepted() =>
        Assert.Equal(HttpStatusCode.OK, (await GetAccountsAsync(_factory.CreateToken())).StatusCode);

    [Fact]
    public async Task BankAuth_WrongIssuerToken_IsRejected() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetAccountsAsync(
            _factory.CreateToken(issuer: "https://issuer.test/realms/ohpp-insurance"))).StatusCode);

    [Fact]
    public async Task BankAuth_WrongAudienceToken_IsRejected() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetAccountsAsync(
            _factory.CreateToken(audience: "ohpp-insurance-app"))).StatusCode);

    [Fact]
    public async Task BankAuth_ExpiredToken_IsRejected() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetAccountsAsync(
            _factory.CreateToken(expiresAt: DateTime.UtcNow.AddMinutes(-1)))).StatusCode);

    private async Task<HttpResponseMessage> GetAccountsAsync(string token)
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.GetAsync("/api/accounts");
    }
}

public sealed class BankJwtApiFactory : WebApplicationFactory<Program>
{
    internal const string Issuer = "https://issuer.test/realms/ohpp-bank";
    internal const string Audience = "ohpp-bank-app";
    private static readonly SymmetricSecurityKey SigningKey = new(
        Encoding.UTF8.GetBytes("bank-jwt-test-signing-key-32-bytes!!"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("WorldDatabase:RunBootstrap", "false");
        builder.ConfigureTestServices(services =>
        {
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            services.RemoveAll<IAccountStore>();
            services.RemoveAll<ITransactionStore>();
            services.RemoveAll<IParticipationClient>();
            services.AddSingleton<IAccountStore, InMemoryAccountStore>();
            services.AddSingleton<ITransactionStore, InMemoryTransactionStore>();
            services.AddSingleton(Substitute.For<IParticipationClient>());
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                options.Configuration = new OpenIdConnectConfiguration { Issuer = Issuer };
                options.Configuration.SigningKeys.Add(SigningKey);
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = Issuer,
                    ValidateAudience = true,
                    ValidAudience = Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = SigningKey,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                };
            });
        });
    }

    public string CreateToken(
        string issuer = Issuer,
        string audience = Audience,
        DateTime? expiresAt = null)
    {
        var token = new JwtSecurityToken(
            issuer,
            audience,
            [new Claim("ohpp_user_id", "demo-user")],
            notBefore: DateTime.UtcNow.AddMinutes(-5),
            expires: expiresAt ?? DateTime.UtcNow.AddMinutes(5),
            signingCredentials: new SigningCredentials(SigningKey, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
