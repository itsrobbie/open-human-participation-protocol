using OHPP.Protocol;
using OHPP.Protocol.Models;

namespace OHPP.Sdk;

/// <summary>
/// Fluent builder for constructing protocol-compliant ParticipationRequests.
/// </summary>
public sealed class ParticipationRequestBuilder
{
    private string? _userId;
    private string? _appId;
    private string? _summary;
    private string? _description;
    private string? _rationale;
    private string? _category;
    private RequestType _type = RequestType.Select;
    private List<RequestOption>? _options;
    private string? _placeholder;
    private bool _masked;
    private string? _keyboard;
    private InputValidation? _inputValidation;
    private DateTimeOffset? _expiry;
    private TransactionInfo? _transaction;

    public ParticipationRequestBuilder ForUser(string userId)
    {
        _userId = userId;
        return this;
    }

    public ParticipationRequestBuilder FromApp(string appId)
    {
        _appId = appId;
        return this;
    }

    public ParticipationRequestBuilder WithSummary(string summary)
    {
        _summary = summary;
        return this;
    }

    public ParticipationRequestBuilder WithDescription(string description)
    {
        _description = description;
        return this;
    }

    public ParticipationRequestBuilder WithRationale(string rationale)
    {
        _rationale = rationale;
        return this;
    }

    public ParticipationRequestBuilder WithCategory(string category)
    {
        _category = category;
        return this;
    }

    public ParticipationRequestBuilder OfType(RequestType type)
    {
        _type = type;
        return this;
    }

    public ParticipationRequestBuilder AddOption(string key, string label, bool freeText = false, string? placeholder = null, InputValidation? validation = null)
    {
        _options ??= new List<RequestOption>();
        _options.Add(new RequestOption
        {
            Key = key,
            Label = label,
            FreeText = freeText,
            Placeholder = placeholder,
            Validation = validation
        });
        return this;
    }

    public ParticipationRequestBuilder WithPlaceholder(string placeholder)
    {
        _placeholder = placeholder;
        return this;
    }

    public ParticipationRequestBuilder AsMasked()
    {
        _masked = true;
        return this;
    }

    public ParticipationRequestBuilder WithKeyboard(string keyboard)
    {
        _keyboard = keyboard;
        return this;
    }

    public ParticipationRequestBuilder WithInputValidation(InputValidation validation)
    {
        _inputValidation = validation;
        return this;
    }

    public ParticipationRequestBuilder ExpiresAt(DateTimeOffset expiry)
    {
        _expiry = expiry;
        return this;
    }

    public ParticipationRequestBuilder ExpiresIn(TimeSpan duration)
    {
        _expiry = DateTimeOffset.UtcNow.Add(duration);
        return this;
    }

    public ParticipationRequestBuilder InTransaction(string transactionId, string? label = null)
    {
        _transaction = new TransactionInfo { Id = transactionId, Label = label };
        return this;
    }

    /// <summary>
    /// Builds the ParticipationRequest. Throws InvalidOperationException if required fields are missing.
    /// </summary>
    public ParticipationRequest Build()
    {
        if (string.IsNullOrWhiteSpace(_userId))
            throw new InvalidOperationException("userId is required (call ForUser)");

        if (string.IsNullOrWhiteSpace(_appId))
            throw new InvalidOperationException("appId is required (call FromApp)");

        if (string.IsNullOrWhiteSpace(_summary))
            throw new InvalidOperationException("summary is required (call WithSummary)");

        return new ParticipationRequest
        {
            Id = Guid.NewGuid().ToString("N"),
            Version = ProtocolConstants.Version,
            Requester = new RequesterInfo { AppId = _appId },
            Validation = new ValidationInfo { UserId = _userId },
            Action = new ActionInfo
            {
                Summary = _summary,
                Description = _description,
                Rationale = _rationale,
                Category = _category
            },
            Type = _type,
            Options = _options?.AsReadOnly(),
            Placeholder = _placeholder,
            Masked = _masked,
            Keyboard = _keyboard,
            InputValidation = _inputValidation,
            Expiry = _expiry,
            Transaction = _transaction,
            CreatedAt = DateTimeOffset.UtcNow
        };
    }
}
