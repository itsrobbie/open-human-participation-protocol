namespace OHPP.Domain.Shared;

public sealed class Result<T>
{
    public T? Value { get; }
    public Error? Error { get; }
    public bool IsSuccess => Error is null;
    public bool IsFailure => Error is not null;

    private Result(T value)
    {
        Value = value;
        Error = null;
    }

    private Result(Error error)
    {
        Value = default;
        Error = error;
    }

    public static Result<T> Success(T value) => new(value);
    public static Result<T> Failure(Error error) => new(error);

    public static implicit operator Result<T>(T value) => Success(value);
    public static implicit operator Result<T>(Error error) => Failure(error);
}

public sealed class Error
{
    public required string Code { get; init; }
    public required string Message { get; init; }
    public IReadOnlyList<ValidationFailure>? ValidationErrors { get; init; }

    public static Error Validation(string message, IReadOnlyList<ValidationFailure> errors) =>
        new() { Code = "VALIDATION_ERROR", Message = message, ValidationErrors = errors };

    public static Error NotFound(string message) =>
        new() { Code = "NOT_FOUND", Message = message };

    public static Error Unauthorized(string message) =>
        new() { Code = "UNAUTHORIZED", Message = message };

    public static Error Forbidden(string message) =>
        new() { Code = "FORBIDDEN", Message = message };

    public static Error Conflict(string message) =>
        new() { Code = "CONFLICT", Message = message };

    public static Error RateLimited(string message) =>
        new() { Code = "RATE_LIMITED", Message = message };

    public static Error ServiceUnavailable(string message) =>
        new() { Code = "SERVICE_UNAVAILABLE", Message = message };
}

public sealed class ValidationFailure
{
    public required string Field { get; init; }
    public required string Message { get; init; }
}
