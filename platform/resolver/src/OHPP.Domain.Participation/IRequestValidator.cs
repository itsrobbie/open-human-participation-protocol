namespace OHPP.Domain.Participation;

public interface IRequestValidator
{
    IReadOnlyList<string> Validate(string requestPayloadJson, DateTimeOffset currentTime);
}
