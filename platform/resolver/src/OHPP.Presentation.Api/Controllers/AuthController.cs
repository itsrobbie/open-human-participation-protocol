using Microsoft.AspNetCore.Mvc;
using OHPP.Domain.Auth;

namespace OHPP.Presentation.Api.Controllers;

/// <summary>
/// The app's ONLY authentication surface. Account creation and sign-in go
/// through here; the Resolver brokers to the configured identity provider via
/// <see cref="IIdentityBroker"/>, so no realm, client id, or provider URL ever
/// reaches a client and the provider can be swapped in production without any
/// app or user-visible change. Anonymous (the caller holds no token yet — see
/// TokenDiscriminationMiddleware.AnonymousPaths).
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IIdentityBroker _broker;

    public AuthController(IIdentityBroker broker)
    {
        _broker = broker;
    }

    /// <summary>Create a new account and return tokens (immediately signed in).</summary>
    [HttpPost("register", Name = "Register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterBody body, CancellationToken ct)
    {
        var result = await _broker.RegisterAsync(
            new RegisterRequest(body.Username, body.Email, body.Password, body.FirstName, body.LastName), ct);
        return Map(result);
    }

    /// <summary>Sign in with existing credentials and return tokens.</summary>
    [HttpPost("login", Name = "Login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginBody body, CancellationToken ct)
    {
        var result = await _broker.AuthenticateAsync(new AuthenticateRequest(body.Username, body.Password), ct);
        return Map(result);
    }

    /// <summary>Renew a session from a refresh token, so the client never
    /// contacts the identity provider directly for refresh either.</summary>
    [HttpPost("refresh", Name = "Refresh")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh([FromBody] RefreshBody body, CancellationToken ct)
    {
        var result = await _broker.RefreshAsync(body.RefreshToken, ct);
        return Map(result);
    }

    private IActionResult Map(OHPP.Domain.Shared.Result<BrokeredAuth> result)
    {
        if (result.IsSuccess)
        {
            var a = result.Value!;
            return Ok(new AuthResponse(a.AccessToken, a.RefreshToken, a.ExpiresInSeconds, a.UserId));
        }

        var error = result.Error!;
        return error.Code switch
        {
            "CONFLICT" => Conflict(new { error = error.Message }),
            "VALIDATION_ERROR" => BadRequest(new { error = error.Message, details = error.ValidationErrors }),
            "UNAUTHORIZED" => Unauthorized(new { error = error.Message }),
            _ => BadRequest(new { error = error.Message }),
        };
    }
}

/// <summary>Registration request body (from the client).</summary>
public sealed record RegisterBody(
    string Username,
    string Email,
    string Password,
    string? FirstName = null,
    string? LastName = null);

/// <summary>Sign-in request body.</summary>
public sealed record LoginBody(string Username, string Password);

/// <summary>Refresh request body.</summary>
public sealed record RefreshBody(string RefreshToken);

/// <summary>
/// Provider-agnostic auth response. The client receives only these fields —
/// nothing that names or reveals the identity provider.
/// </summary>
public sealed record AuthResponse(
    string AccessToken,
    string? RefreshToken,
    int ExpiresInSeconds,
    string UserId);
