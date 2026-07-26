using System.Text.Json;
using System.Text.Json.Serialization;

namespace OHPP.Protocol.Serialisation;

public static class OhppJsonSerialiser
{
    private static readonly JsonSerializerOptions Options = CreateOptions();
    private static readonly JsonSerializerOptions CanonicalOptions = CreateCanonicalOptions();

    public static string Serialise<T>(T value)
    {
        return JsonSerializer.Serialize(value, Options);
    }

    public static T? Deserialise<T>(string json)
    {
        return JsonSerializer.Deserialize<T>(json, Options);
    }

    /// <summary>
    /// Produces deterministic JSON output suitable for signing.
    /// Keys are sorted, no extra whitespace, consistent encoding.
    /// </summary>
    public static string SerialiseCanonical<T>(T value)
    {
        return JsonSerializer.Serialize(value, CanonicalOptions);
    }

    public static JsonSerializerOptions GetOptions() => Options;

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = false
        };
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        return options;
    }

    private static JsonSerializerOptions CreateCanonicalOptions()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = false,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        return options;
    }
}
