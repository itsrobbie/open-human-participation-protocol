using Bank.Domain;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Sdk;

namespace Bank.Infrastructure;

public enum BankProtocolScenario
{
    TransferDecision,
    TransferControls,
    PaymentReference,
    TransferAmount,
    PaymentDate,
    PaymentDateTime,
    HighValueAcknowledgement
}

public sealed record BankProtocolScenarioResult(
    bool Success,
    string? RequestId = null,
    string? Error = null);

public sealed record BankProtocolScenarioStatus(
    RequestStatus? Status,
    string? SelectedOption,
    IReadOnlyList<string>? SelectedOptions,
    string? Value,
    bool AttestationVerified,
    string? Error);

public sealed class BankProtocolScenarioClient
{
    private readonly IOhppRequesterClient _requester;
    private readonly string _appId;

    public BankProtocolScenarioClient(IOhppRequesterClient requester, string appId)
    {
        _requester = requester;
        _appId = appId;
    }

    public async Task<BankProtocolScenarioResult> CreateAsync(
        OhppRegistration registration,
        BankProtocolScenario scenario,
        CancellationToken cancellationToken = default)
    {
        var definition = Definition(scenario);
        var builder = new ParticipationRequestBuilder()
            .ForUser(registration.UserId)
            .FromApp(_appId)
            .WithSummary(definition.Summary)
            .WithDescription(definition.Description)
            .WithCategory("bank-protocol-fixture")
            .OfType(definition.Type)
            .ExpiresIn(TimeSpan.FromMinutes(5));

        if (definition.Type is RequestType.Select or RequestType.Multiselect)
        {
            foreach (var option in definition.Options)
                builder.AddOption(option.Key, option.Label);
        }
        else
        {
            builder.WithPlaceholder(definition.Placeholder);
            if (definition.Type == RequestType.Number)
            {
                builder.WithKeyboard("decimal").WithInputValidation(new InputValidation
                {
                    Required = true,
                    Min = 0.01,
                    Max = 10_000
                });
            }
        }

        var result = await _requester.SendRequestAsync(
            builder.Build(),
            registration.ResolverUrl,
            registration.AccessToken,
            cancellationToken);
        return result.Success
            ? new BankProtocolScenarioResult(true, result.RequestId)
            : new BankProtocolScenarioResult(false, Error: result.Error);
    }

    public async Task<BankProtocolScenarioStatus> GetStatusAsync(
        OhppRegistration registration,
        string requestId,
        CancellationToken cancellationToken = default)
    {
        var result = await _requester.GetStatusAsync(
            requestId,
            registration.ResolverUrl,
            registration.AccessToken,
            cancellationToken);
        if (!result.Success)
            return new BankProtocolScenarioStatus(result.Status, null, null, null, false, result.Error);
        if (result.Status != RequestStatus.Resolved)
            return new BankProtocolScenarioStatus(result.Status, null, null, null, true, null);
        if (result.Attestation is null)
            return new BankProtocolScenarioStatus(result.Status, null, null, null, false, "Resolved response did not include an attestation.");

        var verification = await _requester.VerifyAttestationAsync(
            result.Attestation,
            registration.ResolverUrl,
            cancellationToken);
        return new BankProtocolScenarioStatus(
            result.Status,
            result.SelectedOption,
            result.SelectedOptions,
            result.Value,
            verification.Valid,
            verification.Error);
    }

    private static ScenarioDefinition Definition(BankProtocolScenario scenario) => scenario switch
    {
        BankProtocolScenario.TransferDecision => new(
            RequestType.Select,
            "Choose a transfer decision",
            "Choose how the bank should proceed with this transfer.",
            "Choose an option",
            [new("continue", "Continue"), new("cancel", "Cancel")]),
        BankProtocolScenario.TransferControls => new(
            RequestType.Multiselect,
            "Choose transfer controls",
            "Select the controls that should apply to this transfer.",
            "Choose controls",
            [new("urgent", "Urgent"), new("international", "International")]),
        BankProtocolScenario.PaymentReference => new(
            RequestType.Text,
            "Provide a payment reference",
            "Enter the reference the bank should attach to this payment.",
            "Payment reference",
            []),
        BankProtocolScenario.TransferAmount => new(
            RequestType.Number,
            "Confirm a transfer amount",
            "Enter the amount the bank should use for this transfer.",
            "Amount",
            []),
        BankProtocolScenario.PaymentDate => new(
            RequestType.Date,
            "Choose a payment date",
            "Choose the date on which the bank should make this payment.",
            "Payment date",
            []),
        BankProtocolScenario.PaymentDateTime => new(
            RequestType.DateTime,
            "Choose a payment date and time",
            "Choose the date and time at which the bank should make this payment.",
            "Payment date and time",
            []),
        BankProtocolScenario.HighValueAcknowledgement => new(
            RequestType.Signature,
            "Acknowledge a high-value transfer",
            "Acknowledge that you reviewed the high-value transfer details.",
            "Acknowledge transfer",
            []),
        _ => throw new ArgumentOutOfRangeException(nameof(scenario))
    };

    private sealed record ScenarioOption(string Key, string Label);
    private sealed record ScenarioDefinition(
        RequestType Type,
        string Summary,
        string Description,
        string Placeholder,
        IReadOnlyList<ScenarioOption> Options);
}
