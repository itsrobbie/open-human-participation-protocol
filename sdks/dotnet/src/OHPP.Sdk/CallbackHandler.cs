using System.Text.Json;
using OHPP.Protocol.Models;
using OHPP.Protocol.Serialisation;

namespace OHPP.Sdk;

/// <summary>
/// Handles inbound registration callbacks from Resolvers.
/// When a Resolver completes registration, it POSTs credentials to the Requester's callback path.
/// This handler parses and stores those credentials.
/// </summary>
public sealed class CallbackHandler
{
    private readonly IRegistrationStore _store;

    public CallbackHandler(IRegistrationStore store)
    {
        _store = store;
    }

    /// <summary>
    /// Processes an inbound registration callback body.
    /// Returns the parsed response on success, or null if the payload was invalid.
    /// </summary>
    public async Task<RegistrationResponse?> HandleCallbackAsync(string requestBody, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(requestBody))
            return null;

        RegistrationResponse? response;
        try
        {
            response = OhppJsonSerialiser.Deserialise<RegistrationResponse>(requestBody);
        }
        catch
        {
            return null;
        }

        if (response is null)
            return null;

        if (string.IsNullOrWhiteSpace(response.ChallengeId) ||
            string.IsNullOrWhiteSpace(response.AccessToken) ||
            string.IsNullOrWhiteSpace(response.UserId))
            return null;

        await _store.StoreRegistrationAsync(response, cancellationToken);
        return response;
    }
}

/// <summary>
/// Storage abstraction for registration credentials received from Resolvers.
/// Implementations could persist to database, file, or in-memory for testing.
/// </summary>
public interface IRegistrationStore
{
    Task StoreRegistrationAsync(RegistrationResponse response, CancellationToken cancellationToken = default);
    Task<RegistrationResponse?> GetRegistrationAsync(string userId, string resolverBaseUrl, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RegistrationResponse>> GetAllRegistrationsAsync(CancellationToken cancellationToken = default);
}
