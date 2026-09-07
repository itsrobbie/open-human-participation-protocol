using FluentAssertions;
using OHPP.Infrastructure.OpenTelemetry;
using Xunit;

namespace OHPP.Tests.Unit.Observability;

public class OhppTelemetryEnrichmentTests
{
    // --- BuildCorrelationAttributes ---

    [Fact]
    public void BuildCorrelation_AddsRequestIdAttribute_WhenPresent()
    {
        var attrs = OhppTelemetryEnrichment.BuildCorrelationAttributes(requestId: "req-123");

        attrs.Should().ContainKey(OhppTelemetryEnrichment.RequestIdKey);
        attrs[OhppTelemetryEnrichment.RequestIdKey].Should().Be("req-123");
    }

    [Fact]
    public void BuildCorrelation_OmitsAttribute_WhenAbsent()
    {
        var attrs = OhppTelemetryEnrichment.BuildCorrelationAttributes(requestId: null);

        attrs.Should().NotContainKey(OhppTelemetryEnrichment.RequestIdKey);
    }

    [Fact]
    public void BuildCorrelation_OmitsAttribute_WhenBlank()
    {
        var attrs = OhppTelemetryEnrichment.BuildCorrelationAttributes(requestId: "   ");

        attrs.Should().NotContainKey(OhppTelemetryEnrichment.RequestIdKey);
    }

    [Fact]
    public void BuildCorrelation_IncludesAllProvidedIds()
    {
        var attrs = OhppTelemetryEnrichment.BuildCorrelationAttributes(
            requestId: "req-1", appId: "bank.test", transactionId: "txn-9");

        attrs[OhppTelemetryEnrichment.RequestIdKey].Should().Be("req-1");
        attrs[OhppTelemetryEnrichment.AppIdKey].Should().Be("bank.test");
        attrs[OhppTelemetryEnrichment.TransactionIdKey].Should().Be("txn-9");
    }

    // --- FilterAllowed (PII/secret allowlist, NFR-S1) ---

    [Fact]
    public void FilterAllowed_KeepsAllowedKeys()
    {
        var input = new Dictionary<string, string>
        {
            [OhppTelemetryEnrichment.RequestIdKey] = "req-1",
            [OhppTelemetryEnrichment.AppIdKey] = "bank.test",
        };

        var result = OhppTelemetryEnrichment.FilterAllowed(input);

        result.Should().ContainKey(OhppTelemetryEnrichment.RequestIdKey);
        result.Should().ContainKey(OhppTelemetryEnrichment.AppIdKey);
    }

    [Theory]
    [InlineData("authorization")]
    [InlineData("access_token")]
    [InlineData("refresh_token")]
    [InlineData("device_token")]
    [InlineData("attestation_payload")]
    [InlineData("password")]
    [InlineData("email")]
    public void FilterAllowed_StripsDisallowedKeys(string disallowedKey)
    {
        var input = new Dictionary<string, string>
        {
            [OhppTelemetryEnrichment.RequestIdKey] = "req-1",
            [disallowedKey] = "sensitive-value",
        };

        var result = OhppTelemetryEnrichment.FilterAllowed(input);

        result.Should().NotContainKey(disallowedKey);
        result.Should().ContainKey(OhppTelemetryEnrichment.RequestIdKey);
    }

    [Fact]
    public void FilterAllowed_DropsBlankValues()
    {
        var input = new Dictionary<string, string>
        {
            [OhppTelemetryEnrichment.RequestIdKey] = "",
        };

        var result = OhppTelemetryEnrichment.FilterAllowed(input);

        result.Should().NotContainKey(OhppTelemetryEnrichment.RequestIdKey);
    }

    [Fact]
    public void IsAllowed_ReturnsFalse_ForSensitiveKey()
    {
        OhppTelemetryEnrichment.IsAllowed("access_token").Should().BeFalse();
    }

    [Fact]
    public void IsAllowed_ReturnsTrue_ForRequestId()
    {
        OhppTelemetryEnrichment.IsAllowed(OhppTelemetryEnrichment.RequestIdKey).Should().BeTrue();
    }

    // --- BuildExceptionTags (Phase 4: crash -> OTel error span) ---

    [Fact]
    public void BuildExceptionTags_IncludesTypeMessageAndStacktrace()
    {
        var ex = new InvalidOperationException("boom");

        var tags = OhppTelemetryEnrichment.BuildExceptionTags(ex);

        tags[OhppTelemetryEnrichment.ExceptionTypeKey].Should().Be("System.InvalidOperationException");
        tags[OhppTelemetryEnrichment.ExceptionMessageKey].Should().Be("boom");
        tags[OhppTelemetryEnrichment.ExceptionStacktraceKey].Should().Contain("InvalidOperationException");
    }

    [Fact]
    public void BuildExceptionTags_DoesNotThrow_OnExceptionWithNullMessageType()
    {
        // Sanity: even a bare Exception yields non-empty type + message keys.
        var tags = OhppTelemetryEnrichment.BuildExceptionTags(new Exception());

        tags.Should().ContainKey(OhppTelemetryEnrichment.ExceptionTypeKey);
        tags.Should().ContainKey(OhppTelemetryEnrichment.ExceptionMessageKey);
    }

    // --- ResolveRequestId (error span carries ohpp.request_id when present) ---

    [Fact]
    public void ResolveRequestId_PrefersFirstNonBlankCandidate()
    {
        OhppTelemetryEnrichment.ResolveRequestId(null, "  ", "req-42", "id-7")
            .Should().Be("req-42");
    }

    [Fact]
    public void ResolveRequestId_ReturnsNull_WhenAllBlank()
    {
        OhppTelemetryEnrichment.ResolveRequestId(null, "", "   ").Should().BeNull();
    }
}
