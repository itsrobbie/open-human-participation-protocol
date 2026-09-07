using Microsoft.AspNetCore.Mvc;
using OHPP.Domain.Auth;
using OHPP.Domain.Participation;
using OHPP.Domain.Shared;
using OHPP.Presentation.Api.Filters;

namespace OHPP.Presentation.Api.Controllers;

[Route("api/rules")]
[RequireTokenType(TokenType.IdentityProvider)]
public sealed class RulesController : OhppControllerBase
{
    private readonly IRuleRepository _ruleRepo;
    private readonly IClock _clock;

    public RulesController(IRuleRepository ruleRepo, IClock clock)
    {
        _ruleRepo = ruleRepo;
        _clock = clock;
    }

    [HttpGet(Name = "GetRules")]
    [ProducesResponseType(typeof(RuleResponse[]), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRules()
    {
        var rules = await _ruleRepo.GetByUserIdAsync(UserId);
        return Ok(rules.Select(MapToResponse));
    }

    [HttpPost(Name = "CreateRule")]
    [ProducesResponseType(typeof(RuleResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateRule([FromBody] CreateRuleRequest request)
    {
        var validationError = ValidateRuleRequest(request.Name, request.AuthLevel, request.Conditions);
        if (validationError is not null)
            return BadRequest(new { error = validationError });

        var now = _clock.UtcNow;
        var existingRules = await _ruleRepo.GetByUserIdAsync(UserId);
        var nextPriority = existingRules.Count > 0 ? existingRules.Max(r => r.Priority) + 1 : 1;

        var rule = new ParticipationRule
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            Name = request.Name,
            AppId = request.AppId,
            Priority = nextPriority,
            AuthLevel = request.AuthLevel,
            AutoRespondEnabled = request.AutoRespondEnabled,
            AutoRespondOption = request.AutoRespondOption,
            AutoRespondValue = request.AutoRespondValue,
            Enabled = request.Enabled ?? true,
            CreatedAt = now,
            UpdatedAt = now,
            Conditions = request.Conditions?.Select(c => new RuleCondition
            {
                Id = Guid.NewGuid(),
                Field = c.Field,
                Operator = c.Operator,
                Value = c.Value
            }).ToList() ?? new List<RuleCondition>()
        };

        await _ruleRepo.CreateAsync(rule);
        return CreatedAtRoute("GetRules", null, MapToResponse(rule));
    }

    [HttpPut("{id:guid}", Name = "UpdateRule")]
    [ProducesResponseType(typeof(RuleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateRule(Guid id, [FromBody] UpdateRuleRequest request)
    {
        var rule = await _ruleRepo.GetByIdAsync(id);
        if (rule is null)
            return NotFound();
        if (rule.UserId != UserId)
            return NotFound();

        var validationError = ValidateRuleRequest(request.Name, request.AuthLevel, request.Conditions);
        if (validationError is not null)
            return BadRequest(new { error = validationError });

        rule.Name = request.Name;
        rule.AppId = request.AppId;
        rule.AuthLevel = request.AuthLevel;
        rule.AutoRespondEnabled = request.AutoRespondEnabled;
        rule.AutoRespondOption = request.AutoRespondOption;
        rule.AutoRespondValue = request.AutoRespondValue;
        rule.Enabled = request.Enabled ?? rule.Enabled;
        rule.UpdatedAt = _clock.UtcNow;
        rule.Conditions = request.Conditions?.Select(c => new RuleCondition
        {
            Id = Guid.NewGuid(),
            RuleId = rule.Id,
            Field = c.Field,
            Operator = c.Operator,
            Value = c.Value
        }).ToList() ?? new List<RuleCondition>();

        await _ruleRepo.UpdateAsync(rule);
        return Ok(MapToResponse(rule));
    }

    [HttpDelete("{id:guid}", Name = "DeleteRule")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteRule(Guid id)
    {
        var rule = await _ruleRepo.GetByIdAsync(id);
        if (rule is null)
            return NotFound();
        if (rule.UserId != UserId)
            return NotFound();

        await _ruleRepo.DeleteAsync(id);
        return NoContent();
    }

    [HttpPut("reorder", Name = "ReorderRules")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReorderRules([FromBody] ReorderRulesRequest request)
    {
        if (request.RuleIds is null || request.RuleIds.Count == 0)
            return BadRequest(new { error = "ruleIds is required and must not be empty" });

        // Verify all IDs belong to this user
        var existingRules = await _ruleRepo.GetByUserIdAsync(UserId);
        var existingIds = existingRules.Select(r => r.Id).ToHashSet();

        foreach (var ruleId in request.RuleIds)
        {
            if (!existingIds.Contains(ruleId))
                return BadRequest(new { error = $"Rule {ruleId} not found or does not belong to you" });
        }

        await _ruleRepo.ReorderAsync(UserId, request.RuleIds);
        return Ok(new { reordered = true });
    }

    private static string? ValidateRuleRequest(string? name, string? authLevel, IReadOnlyList<ConditionDto>? conditions)
    {
        if (string.IsNullOrWhiteSpace(name))
            return "name is required";

        if (string.IsNullOrWhiteSpace(authLevel))
            return "authLevel is required";

        var validAuthLevels = new[] { "none", "devicePasscode", "biometric" };
        if (!validAuthLevels.Contains(authLevel))
            return $"authLevel must be one of: {string.Join(", ", validAuthLevels)}";

        if (conditions is not null)
        {
            var validFields = new[] { "appId", "category", "type", "summary", "description", "optionKey", "optionLabel", "numericValue" };
            var validOperators = new[] { "equals", "notEquals", "contains", "notContains", "greaterThan", "lessThan", "greaterOrEqual", "lessOrEqual", "matches" };

            foreach (var condition in conditions)
            {
                if (!validFields.Contains(condition.Field))
                    return $"Invalid condition field: {condition.Field}";
                if (!validOperators.Contains(condition.Operator))
                    return $"Invalid condition operator: {condition.Operator}";
                if (string.IsNullOrWhiteSpace(condition.Value))
                    return "Condition value must not be empty";
            }
        }

        return null;
    }

    private static RuleResponse MapToResponse(ParticipationRule rule) => new(
        rule.Id,
        rule.Name,
        rule.AppId,
        rule.Priority,
        rule.AuthLevel,
        rule.AutoRespondEnabled,
        rule.AutoRespondOption,
        rule.AutoRespondValue,
        rule.Enabled,
        rule.CreatedAt,
        rule.UpdatedAt,
        rule.Conditions.Select(c => new ConditionResponse(c.Id, c.Field, c.Operator, c.Value)).ToList()
    );
}

// --- Request/Response DTOs ---

public sealed record CreateRuleRequest(
    string Name,
    string? AppId,
    string AuthLevel,
    bool AutoRespondEnabled,
    string? AutoRespondOption,
    string? AutoRespondValue,
    bool? Enabled,
    IReadOnlyList<ConditionDto>? Conditions);

public sealed record UpdateRuleRequest(
    string Name,
    string? AppId,
    string AuthLevel,
    bool AutoRespondEnabled,
    string? AutoRespondOption,
    string? AutoRespondValue,
    bool? Enabled,
    IReadOnlyList<ConditionDto>? Conditions);

public sealed record ReorderRulesRequest(IReadOnlyList<Guid> RuleIds);

public sealed record ConditionDto(string Field, string Operator, string Value);

public sealed record RuleResponse(
    Guid Id,
    string Name,
    string? AppId,
    int Priority,
    string AuthLevel,
    bool AutoRespondEnabled,
    string? AutoRespondOption,
    string? AutoRespondValue,
    bool Enabled,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<ConditionResponse> Conditions);

public sealed record ConditionResponse(Guid Id, string Field, string Operator, string Value);
