namespace OHPP.Domain.Shared;

public interface ITokenGenerator
{
    string GenerateDeviceToken();
    string GenerateAppAccessToken();
}
