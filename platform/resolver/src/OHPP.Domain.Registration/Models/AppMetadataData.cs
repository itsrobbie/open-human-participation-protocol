namespace OHPP.Domain.Registration.Models;

public sealed class AppMetadataData
{
    public required string AppId { get; init; }
    public required string Name { get; init; }
    public string? Icon { get; init; }
    public required string RegistrationCallbackPath { get; init; }
    public required string Version { get; init; }
}
