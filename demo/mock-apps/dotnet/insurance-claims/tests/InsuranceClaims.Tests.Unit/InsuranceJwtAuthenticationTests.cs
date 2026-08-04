using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using InsuranceClaims.Domain;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace InsuranceClaims.Tests.Unit;

public sealed class InsuranceJwtAuthenticationTests : IClassFixture<InsuranceJwtApiFactory>
{
    private readonly InsuranceJwtApiFactory _factory;

    public InsuranceJwtAuthenticationTests(InsuranceJwtApiFactory factory) => _factory = factory;

    [Fact]
    public async Task InsuranceAuth_ValidInsuranceRealmToken_IsAccepted() =>
        Assert.Equal(HttpStatusCode.OK, (await GetClaimsAsync(_factory.CreateToken())).StatusCode);

    [Fact]
    public async Task InsuranceAuth_WrongIssuerToken_IsRejected() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetClaimsAsync(
            _factory.CreateToken(issuer: "https://issuer.test/realms/ohpp-bank"))).StatusCode);

    [Fact]
    public async Task InsuranceAuth_WrongAudienceToken_IsRejected() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetClaimsAsync(
            _factory.CreateToken(audience: "ohpp-bank-app"))).StatusCode);

    [Fact]
    public async Task InsuranceAuth_ExpiredToken_IsRejected() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetClaimsAsync(
            _factory.CreateToken(expiresAt: DateTime.UtcNow.AddMinutes(-1)))).StatusCode);

    private async Task<HttpResponseMessage> GetClaimsAsync(string token)
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.GetAsync("/api/claims");
    }
}

public sealed class InsuranceJwtApiFactory : WebApplicationFactory<Program>
{
    internal const string Issuer = "https://issuer.test/realms/ohpp-insurance";
    internal const string Audience = "ohpp-insurance-app";
    private static readonly SymmetricSecurityKey SigningKey = new(
        Encoding.UTF8.GetBytes("insurance-jwt-test-signing-key-32bytes"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("WorldDatabase:RunBootstrap", "false");
        builder.ConfigureTestServices(services =>
        {
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            services.RemoveAll<IClaimRepository>();
            services.RemoveAll<IPolicyRepository>();
            services.RemoveAll<IParticipationClient>();
            services.RemoveAll<IClock>();
            services.AddSingleton<IClaimRepository>(new TestClaimRepository());
            services.AddSingleton<IPolicyRepository>(new TestPolicyRepository());
            services.AddSingleton<IParticipationClient>(new TestParticipationClient());
            services.AddSingleton<IClock>(new FixedClock());
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
