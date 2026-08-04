using System.Text.Json;
using System.Text.Json.Serialization;

namespace OHPP.Protocol.Serialisation;

internal sealed class SignatureAlgorithmJsonConverter : JsonConverter<SignatureAlgorithm>
{
    public override SignatureAlgorithm Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetString();
        if (string.Equals(value, "ES256", StringComparison.OrdinalIgnoreCase)) return SignatureAlgorithm.ES256;
        if (string.Equals(value, "EdDSA", StringComparison.OrdinalIgnoreCase)) return SignatureAlgorithm.EdDSA;
        throw new JsonException($"Unsupported signature algorithm '{value}'");
    }

    public override void Write(Utf8JsonWriter writer, SignatureAlgorithm value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            SignatureAlgorithm.ES256 => "ES256",
            SignatureAlgorithm.EdDSA => "EdDSA",
            _ => throw new JsonException($"Unsupported signature algorithm '{value}'")
        });
    }
}
