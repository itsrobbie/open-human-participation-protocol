import Flutter
import Security
import LocalAuthentication

/// Platform channel handler for cryptographic operations using iOS Secure Enclave.
class CryptoChannel {
    private static let channelName = "dev.ohpp/crypto"
    private static let keyTag = "dev.ohpp.client.signing".data(using: .utf8)!

    private let channel: FlutterMethodChannel

    private init(messenger: FlutterBinaryMessenger) {
        channel = FlutterMethodChannel(name: CryptoChannel.channelName, binaryMessenger: messenger)
        channel.setMethodCallHandler(handle)
    }

    /// Register using a FlutterPluginRegistrar (used by GeneratedPluginRegistrant pattern).
    static func register(with registrar: FlutterPluginRegistrar) {
        _ = CryptoChannel(messenger: registrar.messenger())
    }

    /// Register directly with a binary messenger (for non-plugin contexts).
    static func register(with messenger: FlutterBinaryMessenger) {
        _ = CryptoChannel(messenger: messenger)
    }

    private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "generateKeyPair":
            generateKeyPair(result: result)
        case "sign":
            guard let args = call.arguments as? [String: Any],
                  let payload = args["payload"] as? String else {
                result(FlutterError(code: "INVALID_ARGS", message: "Missing payload", details: nil))
                return
            }
            sign(payload: payload, result: result)
        case "getStorageLevel":
            getStorageLevel(result: result)
        case "deleteKey":
            deleteKey(result: result)
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    // MARK: - Key Generation

    private func generateKeyPair(result: @escaping FlutterResult) {
        // Check if key already exists
        if let existingKey = getExistingPublicKey() {
            result([
                "publicKey": existingKey,
                "keyRef": "dev.ohpp.client.signing",
                "storageLevel": detectStorageLevel()
            ])
            return
        }

        // Generate new key pair in Secure Enclave
        var error: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .biometryCurrentSet],
            &error
        ) else {
            result(FlutterError(
                code: "ACCESS_CONTROL_FAILED",
                message: error?.takeRetainedValue().localizedDescription ?? "Unknown error",
                details: nil
            ))
            return
        }

        var attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: CryptoChannel.keyTag,
                kSecAttrAccessControl as String: accessControl
            ] as [String: Any]
        ]

        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            // Secure Enclave might not be available (simulator), fall back to software
            attributes.removeValue(forKey: kSecAttrTokenID as String)
            guard let softwareKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
                result(FlutterError(
                    code: "KEY_GENERATION_FAILED",
                    message: error?.takeRetainedValue().localizedDescription ?? "Key generation failed",
                    details: nil
                ))
                return
            }
            returnKeyResult(privateKey: softwareKey, result: result)
            return
        }

        returnKeyResult(privateKey: privateKey, result: result)
    }

    private func returnKeyResult(privateKey: SecKey, result: @escaping FlutterResult) {
        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            result(FlutterError(code: "PUBLIC_KEY_FAILED", message: "Could not extract public key", details: nil))
            return
        }

        var error: Unmanaged<CFError>?
        guard let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
            result(FlutterError(
                code: "KEY_EXPORT_FAILED",
                message: error?.takeRetainedValue().localizedDescription ?? "Export failed",
                details: nil
            ))
            return
        }

        // SecKeyCopyExternalRepresentation returns the raw uncompressed EC point
        // (0x04 || X || Y). The resolver verifies with .NET ECDsa.ImportFromPem,
        // so wrap it into a SubjectPublicKeyInfo DER and PEM-encode it.
        let pem = CryptoChannel.spkiPem(fromRawEcPoint: publicKeyData)
        result([
            "publicKey": pem,
            "keyRef": "dev.ohpp.client.signing",
            "storageLevel": detectStorageLevel()
        ])
    }

    // MARK: - Signing

    private func sign(payload: String, result: @escaping FlutterResult) {
        guard let privateKey = getPrivateKey() else {
            result(FlutterError(code: "KEY_NOT_FOUND", message: "No signing key found", details: nil))
            return
        }

        guard let payloadData = payload.data(using: .utf8) else {
            result(FlutterError(code: "INVALID_PAYLOAD", message: "Could not encode payload", details: nil))
            return
        }

        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            privateKey,
            .ecdsaSignatureMessageX962SHA256,
            payloadData as CFData,
            &error
        ) as Data? else {
            let errorDesc = error?.takeRetainedValue().localizedDescription ?? "Signing failed"
            if errorDesc.contains("cancel") || errorDesc.contains("Cancel") {
                result(FlutterError(code: "USER_CANCELLED", message: "Biometric cancelled by user", details: nil))
            } else {
                result(FlutterError(code: "SIGNING_FAILED", message: errorDesc, details: nil))
            }
            return
        }

        // SecKeyCreateSignature with .ecdsaSignatureMessageX962SHA256 returns a
        // DER-encoded ECDSA signature (SEQUENCE { INTEGER r, INTEGER s }). The
        // resolver's .NET ECDsa.VerifyData expects the IEEE-P1363 fixed-width
        // r||s form (32 bytes each for P-256), base64url. Convert.
        guard let raw = CryptoChannel.derToRawRS(signature, componentLength: 32) else {
            result(FlutterError(code: "SIGNING_FAILED", message: "Could not convert signature", details: nil))
            return
        }
        result(["signature": CryptoChannel.base64Url(raw)])
    }

    // MARK: - Storage Level

    private func getStorageLevel(result: @escaping FlutterResult) {
        result(["storageLevel": detectStorageLevel()])
    }

    private func detectStorageLevel() -> String {
        // Check if Secure Enclave is available
        let context = LAContext()
        var canEvaluate = false
        if #available(iOS 11.0, *) {
            canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        }

        // Secure Enclave is available on all devices with Touch ID or Face ID (A7+)
        // On simulator, it's not available
        #if targetEnvironment(simulator)
        return "software"
        #else
        return "secureEnclave"
        #endif
    }

    // MARK: - Delete Key

    private func deleteKey(result: @escaping FlutterResult) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: CryptoChannel.keyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom
        ]

        let status = SecItemDelete(query as CFDictionary)
        result(["deleted": status == errSecSuccess])
    }

    // MARK: - Helpers

    private func getExistingPublicKey() -> String? {
        guard let privateKey = getPrivateKey(),
              let publicKey = SecKeyCopyPublicKey(privateKey) else {
            return nil
        }

        var error: Unmanaged<CFError>?
        guard let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
            return nil
        }

        return CryptoChannel.spkiPem(fromRawEcPoint: publicKeyData)
    }

    private func getPrivateKey() -> SecKey? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: CryptoChannel.keyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return (item as! SecKey)
    }

    // MARK: - Wire-format encoding (match the resolver's ES256 verifier)

    /// base64url without padding.
    static func base64Url(_ data: Data) -> String {
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Convert a DER-encoded ECDSA signature (SEQUENCE { INTEGER r, INTEGER s })
    /// into fixed-width raw r||s of `componentLength` bytes each. Returns nil on
    /// malformed input.
    static func derToRawRS(_ der: Data, componentLength: Int) -> Data? {
        let bytes = [UInt8](der)
        var i = 0
        guard bytes.count > 2, bytes[i] == 0x30 else { return nil }
        i += 1
        // Sequence length (skip; may be short or long form).
        if bytes[i] & 0x80 != 0 {
            let n = Int(bytes[i] & 0x7f); i += 1 + n
        } else {
            i += 1
        }
        func readInt() -> [UInt8]? {
            guard i < bytes.count, bytes[i] == 0x02 else { return nil }
            i += 1
            guard i < bytes.count else { return nil }
            let len = Int(bytes[i]); i += 1
            guard i + len <= bytes.count else { return nil }
            var v = Array(bytes[i..<(i + len)]); i += len
            // Strip leading zero padding.
            while v.count > 1 && v.first == 0x00 { v.removeFirst() }
            return v
        }
        guard let r = readInt(), let s = readInt() else { return nil }
        func fixed(_ v: [UInt8]) -> [UInt8] {
            if v.count == componentLength { return v }
            if v.count > componentLength { return Array(v.suffix(componentLength)) }
            return Array(repeating: 0, count: componentLength - v.count) + v
        }
        return Data(fixed(r) + fixed(s))
    }

    /// Wrap a raw uncompressed EC point (0x04 || X || Y, P-256) into a
    /// SubjectPublicKeyInfo DER and PEM-encode it (BEGIN/END PUBLIC KEY).
    static func spkiPem(fromRawEcPoint point: Data) -> String {
        // AlgorithmIdentifier: id-ecPublicKey (1.2.840.10045.2.1) + prime256v1
        // (1.2.840.10045.3.1.7).
        let oidEcPublicKey: [UInt8] = [0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01]
        let oidP256: [UInt8] = [0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07]
        let algId = der(0x30, oidEcPublicKey + oidP256)
        // BIT STRING: leading 0x00 "unused bits" octet before the point.
        let bitString = der(0x03, [0x00] + [UInt8](point))
        let spki = der(0x30, algId + bitString)

        let b64 = Data(spki).base64EncodedString()
        var lines = ["-----BEGIN PUBLIC KEY-----"]
        var idx = b64.startIndex
        while idx < b64.endIndex {
            let end = b64.index(idx, offsetBy: 64, limitedBy: b64.endIndex) ?? b64.endIndex
            lines.append(String(b64[idx..<end]))
            idx = end
        }
        lines.append("-----END PUBLIC KEY-----")
        return lines.joined(separator: "\n")
    }

    /// Wrap content in a DER TLV with the given tag, encoding the length.
    private static func der(_ tag: UInt8, _ content: [UInt8]) -> [UInt8] {
        var out: [UInt8] = [tag]
        let len = content.count
        if len < 0x80 {
            out.append(UInt8(len))
        } else {
            var lenBytes: [UInt8] = []
            var n = len
            while n > 0 { lenBytes.insert(UInt8(n & 0xff), at: 0); n >>= 8 }
            out.append(0x80 | UInt8(lenBytes.count))
            out.append(contentsOf: lenBytes)
        }
        out.append(contentsOf: content)
        return out
    }
}
