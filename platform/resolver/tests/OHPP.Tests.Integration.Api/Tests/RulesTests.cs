using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OHPP.Tests.Integration.Api.Infrastructure;
using Xunit;

namespace OHPP.Tests.Integration.Api.Tests;

[Trait("Category", "RequiresDocker")]
public sealed class RulesTests : IntegrationTestBase
{
    public RulesTests(TestWebApplicationFactory factory) : base(factory) { }

    // --- Happy path ---

    [Fact]
    public async Task GetRules_EmptyList_Returns200EmptyArray()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.GetAsync("/api/rules");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Be("[]");
    }

    [Fact]
    public async Task CreateRule_ValidPayload_ReturnsCreatedRule()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.PostAsJsonAsync("/api/rules", new
        {
            name = "Pizza low-value",
            appId = "pizza.test",
            authLevel = "none",
            autoRespondEnabled = false,
            conditions = new[]
            {
                new { field = "category", @operator = "equals", value = "order" },
            },
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"name\":\"Pizza low-value\"");
        body.Should().Contain("\"appId\":\"pizza.test\"");
        body.Should().Contain("\"authLevel\":\"none\"");
        body.Should().Contain("\"field\":\"category\"");
    }

    [Fact]
    public async Task RulesCRUD_CreateReadUpdateDelete_FullLifecycle()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        // Create
        var createResponse = await client.PostAsJsonAsync("/api/rules", new
        {
            name = "Lifecycle rule",
            authLevel = "biometric",
            autoRespondEnabled = false,
            conditions = Array.Empty<object>(),
        });
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var createBody = await createResponse.Content.ReadAsStringAsync();
        var id = ExtractId(createBody);

        // Read
        var getResponse = await client.GetAsync("/api/rules");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var getBody = await getResponse.Content.ReadAsStringAsync();
        getBody.Should().Contain("Lifecycle rule");

        // Update
        var updateResponse = await client.PutAsJsonAsync($"/api/rules/{id}", new
        {
            name = "Updated rule",
            authLevel = "devicePasscode",
            autoRespondEnabled = true,
            autoRespondOption = "approve",
            conditions = new[]
            {
                new { field = "type", @operator = "equals", value = "select" },
            },
        });
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updateBody = await updateResponse.Content.ReadAsStringAsync();
        updateBody.Should().Contain("\"name\":\"Updated rule\"");
        updateBody.Should().Contain("\"authLevel\":\"devicePasscode\"");

        // Delete
        var deleteResponse = await client.DeleteAsync($"/api/rules/{id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify gone
        var finalGet = await client.GetAsync("/api/rules");
        var finalBody = await finalGet.Content.ReadAsStringAsync();
        finalBody.Should().Be("[]");
    }

    [Fact]
    public async Task RulesReorder_ThreeRules_PriorityUpdatedCorrectly()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        // Create 3 rules
        var r1 = await CreateRuleAsync(client, "Rule A");
        var r2 = await CreateRuleAsync(client, "Rule B");
        var r3 = await CreateRuleAsync(client, "Rule C");

        // Reorder: C, A, B
        var reorderResponse = await client.PutAsJsonAsync("/api/rules/reorder", new
        {
            ruleIds = new[] { r3, r1, r2 },
        });
        reorderResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify order
        var getResponse = await client.GetAsync("/api/rules");
        var body = await getResponse.Content.ReadAsStringAsync();
        var indexC = body.IndexOf("Rule C", StringComparison.Ordinal);
        var indexA = body.IndexOf("Rule A", StringComparison.Ordinal);
        var indexB = body.IndexOf("Rule B", StringComparison.Ordinal);
        indexC.Should().BeLessThan(indexA);
        indexA.Should().BeLessThan(indexB);
    }

    // --- Non-happy path ---

    [Fact]
    public async Task CreateRule_MissingName_Returns400()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.PostAsJsonAsync("/api/rules", new
        {
            name = "",
            authLevel = "biometric",
            autoRespondEnabled = false,
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateRule_InvalidConditionField_Returns400()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.PostAsJsonAsync("/api/rules", new
        {
            name = "Bad field",
            authLevel = "biometric",
            autoRespondEnabled = false,
            conditions = new[]
            {
                new { field = "nonexistent_field", @operator = "equals", value = "test" },
            },
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Invalid condition field");
    }

    [Fact]
    public async Task UpdateRule_OtherUsersRule_Returns404()
    {
        var (client1, _) = await CreateAuthenticatedUserAsync();
        var (client2, _) = await CreateAuthenticatedUserAsync();

        // User 1 creates a rule
        var id = await CreateRuleAsync(client1, "User1 Rule");

        // User 2 tries to update it
        var response = await client2.PutAsJsonAsync($"/api/rules/{id}", new
        {
            name = "Hijacked",
            authLevel = "none",
            autoRespondEnabled = false,
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteRule_OtherUsersRule_Returns404()
    {
        var (client1, _) = await CreateAuthenticatedUserAsync();
        var (client2, _) = await CreateAuthenticatedUserAsync();

        var id = await CreateRuleAsync(client1, "Protected Rule");

        var response = await client2.DeleteAsync($"/api/rules/{id}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetRules_OtherUsersRulesNotVisible()
    {
        var (client1, _) = await CreateAuthenticatedUserAsync();
        var (client2, _) = await CreateAuthenticatedUserAsync();

        await CreateRuleAsync(client1, "Secret Rule");

        var response = await client2.GetAsync("/api/rules");
        var body = await response.Content.ReadAsStringAsync();
        body.Should().NotContain("Secret Rule");
    }

    [Fact]
    public async Task RulesAuth_DeviceToken_Returns401()
    {
        var (_, userId) = await CreateAuthenticatedUserAsync();
        var (deviceClient, _, _) = await CreateAuthenticatedDeviceAsync(userId);

        var response = await deviceClient.GetAsync("/api/rules");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateRule_WithAutoRespond_StoresConfig()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.PostAsJsonAsync("/api/rules", new
        {
            name = "Auto-approve small orders",
            authLevel = "none",
            autoRespondEnabled = true,
            autoRespondOption = "approve",
            autoRespondValue = "auto-approved",
            conditions = new[]
            {
                new { field = "category", @operator = "equals", value = "order" },
            },
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"autoRespondEnabled\":true");
        body.Should().Contain("\"autoRespondOption\":\"approve\"");
        body.Should().Contain("\"autoRespondValue\":\"auto-approved\"");
    }

    [Fact]
    public async Task CreateRule_InvalidConditionOperator_Returns400()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.PostAsJsonAsync("/api/rules", new
        {
            name = "Bad operator",
            authLevel = "biometric",
            autoRespondEnabled = false,
            conditions = new[]
            {
                new { field = "summary", @operator = "invalidOp", value = "test" },
            },
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Invalid condition operator");
    }

    [Fact]
    public async Task CreateRule_EmptyConditionValue_Returns400()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var response = await client.PostAsJsonAsync("/api/rules", new
        {
            name = "Empty value",
            authLevel = "biometric",
            autoRespondEnabled = false,
            conditions = new[]
            {
                new { field = "summary", @operator = "contains", value = "" },
            },
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Condition value must not be empty");
    }

    [Fact]
    public async Task UpdateRule_RuleNotFound_Returns404()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var nonExistentId = Guid.NewGuid();
        var response = await client.PutAsJsonAsync($"/api/rules/{nonExistentId}", new
        {
            name = "Ghost rule",
            authLevel = "biometric",
            autoRespondEnabled = false,
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteRule_RuleNotFound_Returns404()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        var nonExistentId = Guid.NewGuid();
        var response = await client.DeleteAsync($"/api/rules/{nonExistentId}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ReorderRules_MissingRuleId_Returns400()
    {
        var (client, _) = await CreateAuthenticatedUserAsync();

        // Create one rule, then try to reorder with a non-existent ID
        var r1 = await CreateRuleAsync(client, "Real Rule");
        var fakeId = Guid.NewGuid();

        var response = await client.PutAsJsonAsync("/api/rules/reorder", new
        {
            ruleIds = new[] { r1, fakeId },
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("not found or does not belong to you");
    }

    [Fact]
    public async Task ReorderRules_OtherUsersRuleId_Returns400()
    {
        var (client1, _) = await CreateAuthenticatedUserAsync();
        var (client2, _) = await CreateAuthenticatedUserAsync();

        // User 1 creates rules
        var r1 = await CreateRuleAsync(client1, "User1 Rule A");
        var r2 = await CreateRuleAsync(client1, "User1 Rule B");

        // User 2 creates a rule
        var r3 = await CreateRuleAsync(client2, "User2 Rule");

        // User 2 tries to reorder including User1's rule
        var response = await client2.PutAsJsonAsync("/api/rules/reorder", new
        {
            ruleIds = new[] { r3, r1 },
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("not found or does not belong to you");
    }

    // --- Helpers ---

    private async Task<Guid> CreateRuleAsync(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/rules", new
        {
            name,
            authLevel = "biometric",
            autoRespondEnabled = false,
            conditions = Array.Empty<object>(),
        });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync();
        return ExtractId(body);
    }

    private static Guid ExtractId(string json)
    {
        // Simple extraction: find "id":"<guid>"
        var start = json.IndexOf("\"id\":\"", StringComparison.Ordinal) + 6;
        var end = json.IndexOf("\"", start, StringComparison.Ordinal);
        return Guid.Parse(json[start..end]);
    }
}
