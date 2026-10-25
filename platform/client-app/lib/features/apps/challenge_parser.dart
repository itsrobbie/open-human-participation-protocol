import 'dart:convert';

/// Errors that can occur when parsing a registration challenge.
enum ChallengeError {
  /// Base64 or JSON format is invalid.
  format,

  /// Required fields missing or appId format invalid.
  invalid,

  /// Challenge has expired.
  expired,
}

/// A parsed registration challenge.
class ParsedChallenge {
  final String appId;
  final String id;
  final DateTime expiry;

  /// The base64url challenge payload (the `{challenge}` param, or the raw input
  /// when the input was already a bare payload). This is what the Resolver's
  /// POST /api/registrations/process-challenge expects as `challengePayload`.
  final String base64Payload;

  const ParsedChallenge({
    required this.appId,
    required this.id,
    required this.expiry,
    required this.base64Payload,
  });
}

/// Result of parsing a challenge (either success or error).
class ChallengeParseResult {
  final ParsedChallenge? challenge;
  final ChallengeError? error;

  const ChallengeParseResult.success(ParsedChallenge this.challenge) : error = null;
  const ChallengeParseResult.failure(ChallengeError this.error) : challenge = null;

  bool get isSuccess => challenge != null;
}

/// Parses `ohpp://register?challenge={base64url}` URIs or raw base64url challenge strings.
class ChallengeParser {
  /// Domain format: at least one dot, no spaces, alphanumeric + dots + hyphens.
  static final _domainRegex = RegExp(r'^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)+$');

  /// Parse a challenge string. Accepts either:
  /// - Full URI: `ohpp://register?challenge={base64url}`
  /// - Raw base64url-encoded challenge JSON
  ChallengeParseResult parse(String input) {
    if (input.isEmpty) {
      return const ChallengeParseResult.failure(ChallengeError.format);
    }

    String base64Payload;

    // Check if it's a full ohpp:// URI
    if (input.startsWith('ohpp://')) {
      final uri = Uri.tryParse(input);
      if (uri == null) {
        return const ChallengeParseResult.failure(ChallengeError.format);
      }
      final challengeParam = uri.queryParameters['challenge'];
      if (challengeParam == null || challengeParam.isEmpty) {
        return const ChallengeParseResult.failure(ChallengeError.invalid);
      }
      base64Payload = challengeParam;
    } else {
      base64Payload = input;
    }

    // Decode base64url
    String jsonString;
    try {
      final bytes = base64Url.decode(_padBase64(base64Payload));
      jsonString = utf8.decode(bytes);
    } catch (_) {
      return const ChallengeParseResult.failure(ChallengeError.format);
    }

    // Parse JSON
    Map<String, dynamic> json;
    try {
      json = jsonDecode(jsonString) as Map<String, dynamic>;
    } catch (_) {
      return const ChallengeParseResult.failure(ChallengeError.format);
    }

    // Validate required fields
    final appId = json['appId'] as String?;
    final id = json['id'] as String?;
    final expiryStr = json['expiry'] as String?;

    if (appId == null || appId.isEmpty) {
      return const ChallengeParseResult.failure(ChallengeError.invalid);
    }
    if (id == null || id.isEmpty) {
      return const ChallengeParseResult.failure(ChallengeError.invalid);
    }
    if (expiryStr == null || expiryStr.isEmpty) {
      return const ChallengeParseResult.failure(ChallengeError.invalid);
    }

    // Validate appId format (domain-based)
    if (!_domainRegex.hasMatch(appId)) {
      return const ChallengeParseResult.failure(ChallengeError.invalid);
    }

    // Parse and validate expiry
    final expiry = DateTime.tryParse(expiryStr);
    if (expiry == null) {
      return const ChallengeParseResult.failure(ChallengeError.invalid);
    }

    if (expiry.isBefore(DateTime.now().toUtc())) {
      return const ChallengeParseResult.failure(ChallengeError.expired);
    }

    return ChallengeParseResult.success(ParsedChallenge(
      appId: appId,
      id: id,
      expiry: expiry,
      base64Payload: base64Payload,
    ));
  }

  /// Pad base64 string to multiple of 4 (base64url may omit padding).
  String _padBase64(String input) {
    final remainder = input.length % 4;
    if (remainder == 0) return input;
    return input + '=' * (4 - remainder);
  }
}
