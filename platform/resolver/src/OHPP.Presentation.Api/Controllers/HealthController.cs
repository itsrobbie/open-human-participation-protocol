using Microsoft.AspNetCore.Mvc;
using OHPP.Infrastructure.PostgreSQL;

namespace OHPP.Presentation.Api.Controllers;

[Route("health")]
public sealed class HealthController : OhppControllerBase
{
    private readonly AppDbContext _db;

    public HealthController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("")]
    public IActionResult Shallow() => Ok(new { status = "healthy" });

    [HttpGet("ready")]
    public async Task<IActionResult> Ready()
    {
        try
        {
            await _db.Database.CanConnectAsync();
            return Ok(new { status = "ready" });
        }
        catch
        {
            return StatusCode(503, new { status = "unavailable" });
        }
    }
}
