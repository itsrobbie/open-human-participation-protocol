using FsCheck;
using FsCheck.Xunit;
using OHPP.Protocol;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;

namespace OHPP.Sdk.Tests.Unit;

public sealed class PropertyTests
{
    [Property]
    public bool PBT_RoundTrip_ChallengeSerialisation_Identity(byte variant)
    {
        var options = new OhppRequesterOptions
        {
            AppId = "test.example.com",
            AppName = "Test",
            CallbackPath = "/cb",
            BaseUrl = "https://test.example.com"
        };
        var generator = new ChallengeGenerator(options);

        var challenge = generator.CreateChallenge(TimeSpan.FromMinutes(variant + 1));
        var encoded = ChallengeGenerator.EncodeChallenge(challenge);
        var decoded = ChallengeGenerator.DecodeChallenge(encoded);

        return decoded is not null
            && decoded.ChallengeId == challenge.ChallengeId
            && decoded.RequesterAppId == challenge.RequesterAppId;
    }

    [Property]
    public bool PBT_RoundTrip_RequestSerialisation_Identity(byte variant)
    {
        var request = new ParticipationRequestBuilder()
            .ForUser($"user-{variant}")
            .FromApp("app.test")
            .WithSummary($"Summary {variant}")
            .OfType(RequestType.Text)
            .Build();

        var json = OhppJsonSerialiser.Serialise(request);
        var deserialized = OhppJsonSerialiser.Deserialise<ParticipationRequest>(json);

        return deserialized is not null
            && deserialized.Id == request.Id
            && deserialized.Validation.UserId == request.Validation.UserId
            && deserialized.Action.Summary == request.Action.Summary;
    }
}
