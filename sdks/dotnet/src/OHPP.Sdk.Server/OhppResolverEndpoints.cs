using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using OHPP.Protocol.Serialisation;

namespace OHPP.Sdk.Server;

/// <summary>
/// Maps OHPP protocol endpoints (metadata, JWKS, participate, status, cancel) using minimal APIs.
/// The host calls app.UseOhppResolver() to register these routes.
/// </summary>
public static class OhppResolverEndpoints
{
    /// <summary>
    /// Maps OHPP protocol endpoints to the application pipeline.
    /// Requires IOhppResolverServices and IOhppAuthContextAccessor to be registered in DI.
    /// </summary>
    public static IEndpointRouteBuilder UseOhppResolver(this IEndpointRouteBuilder endpoints)
    {
        var options = endpoints.ServiceProvider.GetRequiredService<IOptions<OhppResolverOptions>>().Value;

        endpoints.MapGet("/.well-known/ohpp/metadata", (IOptions<OhppResolverOptions> opts) =>
        {
            var metadata = MetadataBuilder.Build(opts.Value);
            var json = OhppJsonSerialiser.Serialise(metadata);
            return Results.Content(json, "application/json");
        });

        endpoints.MapGet(options.JwksPath, async (IOhppResolverServices services) =>
        {
            var jwks = await services.GetJwksAsync();
            var json = OhppJsonSerialiser.Serialise(jwks);
            return Results.Content(json, "application/json");
        });

        endpoints.MapPost(options.ParticipatePath, async (HttpContext context, IOhppResolverServices services, IOhppAuthContextAccessor authAccessor) =>
        {
            // Auth check first — revoked/invalid tokens must get 401 before any processing
            var authContext = authAccessor.GetAppContext(context);
            if (authContext is null)
                return Results.Unauthorized();

            // Read the body
            using var reader = new StreamReader(context.Request.Body);
            var body = await reader.ReadToEndAsync();

            // Extract the payload field from the wrapper
            string? payload = null;
            try
            {
                var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("payload", out var payloadProp))
                    payload = payloadProp.GetString();
            }
            catch
            {
                return Results.BadRequest(new { error = "Invalid request body" });
            }

            // Validate the protocol payload
            var errors = RequestValidationPipeline.Validate(payload, DateTimeOffset.UtcNow);
            if (errors.Count > 0)
                return Results.UnprocessableEntity(new { errors });

            var result = await services.ProcessParticipationRequestAsync(
                authContext.AppRegistrationId,
                authContext.UserId,
                authContext.AppId,
                payload!);

            if (!result.IsSuccess)
                return Results.Problem(detail: result.Error, statusCode: result.SuggestedStatusCode);

            return Results.Created($"{options.StatusPathTemplate.Replace("{requestId}", result.Value)}", new { requestId = result.Value });
        });

        endpoints.MapGet(options.StatusPathTemplate.Replace("{requestId}", "{requestId:guid}"),
            async (Guid requestId, HttpContext context, IOhppResolverServices services, IOhppAuthContextAccessor authAccessor) =>
        {
            var authContext = authAccessor.GetAppContext(context);
            if (authContext is null)
                return Results.Unauthorized();

            var result = await services.GetRequestStatusAsync(requestId, authContext.AppRegistrationId);

            if (!result.IsSuccess)
                return Results.Problem(detail: result.Error, statusCode: result.SuggestedStatusCode);

            var json = OhppJsonSerialiser.Serialise(result.Value);
            return Results.Content(json, "application/json");
        });

        endpoints.MapPost(options.CancelPathTemplate.Replace("{requestId}", "{requestId:guid}"),
            async (Guid requestId, HttpContext context, IOhppResolverServices services, IOhppAuthContextAccessor authAccessor) =>
        {
            var authContext = authAccessor.GetAppContext(context);
            if (authContext is null)
                return Results.Unauthorized();

            var result = await services.CancelRequestAsync(requestId, authContext.AppRegistrationId);

            if (!result.IsSuccess)
                return Results.Problem(detail: result.Error, statusCode: result.SuggestedStatusCode);

            return Results.Ok(new { status = "cancelled" });
        });

        return endpoints;
    }
}
