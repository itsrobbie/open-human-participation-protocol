using Microsoft.AspNetCore.Mvc;
using OHPP.Domain.Auth;
using OHPP.Domain.Registration;
using OHPP.Presentation.Api.Filters;

namespace OHPP.Presentation.Api.Controllers;

[Route("api/registrations")]
[RequireTokenType(TokenType.IdentityProvider)]
public sealed class RegistrationController : OhppControllerBase
{
    private readonly IRegistrationCeremonyOrchestrator _orchestrator;

    public RegistrationController(IRegistrationCeremonyOrchestrator orchestrator)
    {
        _orchestrator = orchestrator;
    }

    [HttpPost("process-challenge")]
    public async Task<IActionResult> ProcessChallenge([FromBody] ProcessChallengeRequest request)
    {
        var result = await _orchestrator.ProcessChallengeAsync(UserId, request.ChallengePayload);

        if (result.IsFailure)
            return BadRequest(new { error = result.Error });

        return Ok(new { appId = result.Value!.AppId, appName = result.Value.AppName });
    }
}

public sealed record ProcessChallengeRequest(string ChallengePayload);
