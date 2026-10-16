/// Base class for API exceptions.
abstract class ApiException implements Exception {
  final String message;
  final int? statusCode;
  const ApiException(this.message, {this.statusCode});

  @override
  String toString() => '$runtimeType: $message (status: $statusCode)';
}

/// Authentication failed (401). Session may have expired.
class AuthException extends ApiException {
  const AuthException([String message = 'Authentication failed']) : super(message, statusCode: 401);
}

/// Request already resolved by another device (409).
class AlreadyResolvedException extends ApiException {
  const AlreadyResolvedException([String message = 'Already resolved']) : super(message, statusCode: 409);
}

/// Validation error (400). Request payload was invalid.
class ValidationException extends ApiException {
  const ValidationException([String message = 'Validation failed']) : super(message, statusCode: 400);
}

/// Server error (5xx). Transient failure.
class ServerException extends ApiException {
  const ServerException([String message = 'Server error']) : super(message, statusCode: 500);
}

/// Network connectivity error. Device may be offline.
class ConnectivityException extends ApiException {
  const ConnectivityException([String message = 'No network connectivity']) : super(message);
}

/// Request timed out.
class ApiTimeoutException extends ApiException {
  const ApiTimeoutException([String message = 'Request timed out']) : super(message);
}
