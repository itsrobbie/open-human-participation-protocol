using OHPP.Protocol.Models;

namespace OHPP.Domain.Registration;

public interface IRegistrationCallbackSender
{
    Task<bool> SendAsync(string callbackUrl, RegistrationResponse response, CancellationToken cancellationToken = default);
}
