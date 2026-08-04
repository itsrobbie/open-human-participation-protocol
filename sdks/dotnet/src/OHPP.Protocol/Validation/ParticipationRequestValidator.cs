using OHPP.Protocol.Models;
using System.Text.RegularExpressions;

namespace OHPP.Protocol.Validation;

public static class ParticipationRequestValidator
{
    public static IReadOnlyList<string> Validate(ParticipationRequest request, DateTimeOffset? currentTime = null)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(request.Id))
            errors.Add("id is required");

        if (string.IsNullOrWhiteSpace(request.Version))
            errors.Add("version is required");

        if (string.IsNullOrWhiteSpace(request.Requester?.AppId))
            errors.Add("requester.appId is required");

        if (string.IsNullOrWhiteSpace(request.Validation?.UserId))
            errors.Add("validation.userId is required");

        ValidateAction(request.Action, errors);
        ValidateType(request.Type, request.Options, errors);
        ValidateOptions(request.Type, request.Options, errors);
        ValidateInputValidation(request.InputValidation, "inputValidation", errors);
        ValidateExpiry(request.Expiry, currentTime ?? DateTimeOffset.UtcNow, errors);

        return errors;
    }

    private static void ValidateAction(ActionInfo? action, List<string> errors)
    {
        if (action is null)
        {
            errors.Add("action is required");
            return;
        }

        if (string.IsNullOrWhiteSpace(action.Summary))
            errors.Add("action.summary is required");
        else if (action.Summary.Length > ProtocolConstants.MaxLengths.Summary)
            errors.Add($"action.summary must not exceed {ProtocolConstants.MaxLengths.Summary} characters");

        if (action.Description is not null && action.Description.Length > ProtocolConstants.MaxLengths.Description)
            errors.Add($"action.description must not exceed {ProtocolConstants.MaxLengths.Description} characters");

        if (action.Rationale is not null && action.Rationale.Length > ProtocolConstants.MaxLengths.Rationale)
            errors.Add($"action.rationale must not exceed {ProtocolConstants.MaxLengths.Rationale} characters");

        if (action.Category is not null && action.Category.Length > ProtocolConstants.MaxLengths.Category)
            errors.Add($"action.category must not exceed {ProtocolConstants.MaxLengths.Category} characters");
    }

    private static void ValidateType(RequestType type, IReadOnlyList<RequestOption>? options, List<string> errors)
    {
        var requiresOptions = type is RequestType.Select or RequestType.Multiselect;

        if (requiresOptions && (options is null || options.Count < ProtocolConstants.MinCounts.OptionsForSelect))
            errors.Add($"options must contain at least {ProtocolConstants.MinCounts.OptionsForSelect} entries for {type} type");

        if (!requiresOptions && options is not null && options.Count > 0)
            errors.Add($"options must be null or empty for {type} type");
    }

    private static void ValidateOptions(RequestType type, IReadOnlyList<RequestOption>? options, List<string> errors)
    {
        if (options is null) return;

        var keys = new HashSet<string>();
        for (var index = 0; index < options.Count; index++)
        {
            var option = options[index];
            if (string.IsNullOrWhiteSpace(option.Key))
                errors.Add("options[].key must not be empty");

            if (string.IsNullOrWhiteSpace(option.Label))
                errors.Add("options[].label must not be empty");
            else if (option.Label.Length > ProtocolConstants.MaxLengths.OptionLabel)
                errors.Add($"options[].label must not exceed {ProtocolConstants.MaxLengths.OptionLabel} characters");

            if (!string.IsNullOrWhiteSpace(option.Key) && !keys.Add(option.Key))
                errors.Add($"options[].key must be unique within a request (duplicate: '{option.Key}')");

            ValidateInputValidation(option.Validation, $"options[{index}].validation", errors);
        }
    }

    private static void ValidateInputValidation(InputValidation? validation, string path, List<string> errors)
    {
        if (validation is null) return;

        if (validation.Min.HasValue && validation.Max.HasValue && validation.Min.Value > validation.Max.Value)
            errors.Add($"{path}.min must not exceed {path}.max");

        if (validation.Pattern is null) return;

        try
        {
            _ = new Regex(validation.Pattern);
        }
        catch (ArgumentException)
        {
            errors.Add($"{path}.pattern must be a valid regular expression");
        }
    }

    private static void ValidateExpiry(DateTimeOffset? expiry, DateTimeOffset now, List<string> errors)
    {
        if (expiry.HasValue && expiry.Value <= now)
            errors.Add("expiry must be in the future");
    }
}
