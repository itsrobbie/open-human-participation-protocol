using System.Text.Json;
using OHPP.Domain.Participation;

namespace OHPP.Services.Participation;

public static class DeviceParticipationRequestMapper
{
    public static DeviceParticipationRequest Map(PendingRequest request)
    {
        using var document = JsonDocument.Parse(request.RequestPayload);
        var root = document.RootElement;
        var action = root.TryGetProperty("action", out var actionElement) ? actionElement : default;

        return new DeviceParticipationRequest
        {
            RequestId = request.Id,
            AppId = request.AppId,
            Summary = ReadString(action, "summary") ?? request.ActionSummary,
            Description = ReadString(action, "description"),
            Rationale = ReadString(root, "rationale"),
            Category = ReadString(root, "category"),
            Type = request.Type,
            Options = ReadOptions(root),
            Expiry = request.ExpiresAt,
            ReceivedAt = request.CreatedAt
        };
    }

    private static IReadOnlyList<DeviceRequestOption>? ReadOptions(JsonElement root)
    {
        if (!root.TryGetProperty("options", out var options) || options.ValueKind != JsonValueKind.Array)
            return null;

        return options.EnumerateArray()
            .Select(option => new DeviceRequestOption
            {
                Key = ReadString(option, "key") ?? string.Empty,
                Label = ReadString(option, "label") ?? string.Empty,
                FreeText = option.TryGetProperty("freeText", out var freeText) && freeText.ValueKind == JsonValueKind.True,
                Placeholder = ReadString(option, "placeholder")
            })
            .ToList();
    }

    private static string? ReadString(JsonElement element, string propertyName)
    {
        return element.ValueKind == JsonValueKind.Object &&
               element.TryGetProperty(propertyName, out var property) &&
               property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }
}
