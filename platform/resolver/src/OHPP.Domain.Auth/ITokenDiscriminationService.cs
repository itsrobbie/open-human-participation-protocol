namespace OHPP.Domain.Auth;

public interface ITokenDiscriminationService
{
    TokenType DetermineTokenType(string? token);
}
