using OHPP.Cli.Domain;
using OHPP.Cli.Services;

namespace OHPP.Cli.Presentation;

public sealed class CliRequestHandler
{
    private readonly TextReader _input;
    private readonly TextWriter _output;
    private readonly AttestationBuilder _attestationBuilder;

    public CliRequestHandler(TextReader input, TextWriter output, AttestationBuilder attestationBuilder)
    {
        _input = input;
        _output = output;
        _attestationBuilder = attestationBuilder;
    }

    public async Task<bool> HandleAsync(
        IncomingRequest request,
        CliConfig config,
        IResolverClient resolverClient,
        CancellationToken cancellationToken = default)
    {
        await _output.WriteLineAsync($"Request from: {request.AppId}");
        await _output.WriteLineAsync(request.Summary);
        if (request.Description is not null)
            await _output.WriteLineAsync(request.Description);
        if (request.Rationale is not null)
            await _output.WriteLineAsync($"Reason: {request.Rationale}");

        string decision;
        if (request.Options is { Count: > 0 })
        {
            for (var index = 0; index < request.Options.Count; index++)
                await _output.WriteLineAsync($"[{index + 1}] {request.Options[index].Label}");

            await _output.WriteAsync("Your choice (number): ");
            var input = (await _input.ReadLineAsync())?.Trim() ?? string.Empty;
            if (!int.TryParse(input, out var choice) || choice < 1 || choice > request.Options.Count)
            {
                await _output.WriteLineAsync("Invalid choice. Skipping.");
                return false;
            }

            decision = request.Options[choice - 1].Key;
        }
        else
        {
            await _output.WriteAsync("Your response: ");
            decision = (await _input.ReadLineAsync())?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(decision))
            {
                await _output.WriteLineAsync("Empty response. Skipping.");
                return false;
            }
        }

        var payload = _attestationBuilder.BuildPayload(request.RequestId, decision, request.Type);
        var signature = _attestationBuilder.Sign(payload, config.PrivateKeyPem!);
        var submitted = await resolverClient.SubmitAttestationAsync(
            request.RequestId, payload, signature, cancellationToken);
        await _output.WriteLineAsync(submitted ? "Attestation submitted." : "Submission failed.");
        return submitted;
    }
}
