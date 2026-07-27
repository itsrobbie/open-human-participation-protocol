using OHPP.Protocol.Models;

namespace OHPP.Domain.Registration;

public interface IRegistrationCallbackSender
{
    /// <summary>
    /// Sends the registration response to the Requester's callback endpoint.
    /// The implementation resolves appId to a base URL (e.g., via dev override map or https://{appId} in production).
    /// </summary>
    Task<bool> SendAsync(string appId, string callbackPath, RegistrationResponse response, CancellationToken cancellationToken = default);
}
