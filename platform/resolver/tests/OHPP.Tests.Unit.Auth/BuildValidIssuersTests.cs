using FluentAssertions;
using OHPP.Infrastructure.Keycloak;
using Xunit;

namespace OHPP.Tests.Unit.Auth;

/// <summary>
/// Cross-realm / issuer acceptance for the identity token validator (Phase 3.3).
///
/// The resolver validates the identity token issuer against a derived allow-list
/// (ValidateIssuer=true, ValidIssuers=BuildValidIssuers(authority)). The
/// integration layer swaps in a FAKE validator, so the real cross-realm rejection
/// lives only here, at the unit layer: a token minted by a DIFFERENT realm has an
/// issuer that is never in the allow-list, so it is rejected. These tests pin that
/// allow-list so a regression that widened it (and let another realm's token in)
/// would fail.
/// </summary>
public sealed class BuildValidIssuersTests
{
    [Fact]
    public void Includes_the_configured_authority_and_browser_facing_host_variants_for_the_same_realm()
    {
        var issuers = KeycloakIdentityTokenValidator.BuildValidIssuers(
            "http://keycloak:8080/realms/ohpp");

        issuers.Should().Contain("http://keycloak:8080/realms/ohpp");
        // Browser-facing hosts Keycloak may stamp into the issuer claim in dev,
        // but ONLY for the SAME realm path.
        issuers.Should().Contain("http://localhost:8080/realms/ohpp");
        issuers.Should().Contain("http://localhost:8180/realms/ohpp");
        issuers.Should().OnlyContain(i => i.EndsWith("/realms/ohpp"));
    }

    [Fact]
    public void Does_not_accept_another_realm_cross_realm_rejection()
    {
        var issuers = KeycloakIdentityTokenValidator.BuildValidIssuers(
            "http://keycloak:8080/realms/ohpp");

        // A token from another realm carries an issuer ending in that realm's path.
        // None of our valid issuers match it, so cross-realm tokens are rejected.
        issuers.Should().NotContain(i => i.Contains("/realms/evil"));
        issuers.Should().NotContain(i => i.Contains("/realms/other-tenant"));
        issuers.Should().NotContain("http://keycloak:8080/realms/evil");
    }

    [Fact]
    public void Trailing_slash_on_authority_does_not_change_the_accepted_issuers()
    {
        var withSlash = KeycloakIdentityTokenValidator.BuildValidIssuers(
            "http://keycloak:8080/realms/ohpp/");
        var without = KeycloakIdentityTokenValidator.BuildValidIssuers(
            "http://keycloak:8080/realms/ohpp");

        withSlash.Should().BeEquivalentTo(without);
    }

    [Fact]
    public void A_different_realm_authority_produces_a_disjoint_allow_list()
    {
        var ohpp = KeycloakIdentityTokenValidator.BuildValidIssuers(
            "http://keycloak:8080/realms/ohpp");
        var other = KeycloakIdentityTokenValidator.BuildValidIssuers(
            "http://keycloak:8080/realms/other-tenant");

        // No issuer accepted for tenant A is accepted for tenant B.
        ohpp.Should().NotIntersectWith(other);
    }
}
