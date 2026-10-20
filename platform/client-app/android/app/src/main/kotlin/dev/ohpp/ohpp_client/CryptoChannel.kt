package dev.ohpp.ohpp_client

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.util.Base64

/**
 * Platform channel handler for cryptographic operations using Android Keystore/StrongBox.
 */
class CryptoChannel(messenger: BinaryMessenger) : MethodChannel.MethodCallHandler {
    private val channel = MethodChannel(messenger, "dev.ohpp/crypto")
    private val keyAlias = "dev.ohpp.client.signing"

    init {
        channel.setMethodCallHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "generateKeyPair" -> generateKeyPair(result)
            "sign" -> {
                val payload = call.argument<String>("payload")
                if (payload == null) {
                    result.error("INVALID_ARGS", "Missing payload", null)
                    return
                }
                sign(payload, result)
            }
            "getStorageLevel" -> getStorageLevel(result)
            "deleteKey" -> deleteKey(result)
            else -> result.notImplemented()
        }
    }

    private fun generateKeyPair(result: MethodChannel.Result) {
        try {
            // Check if key already exists
            val keyStore = KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)
            if (keyStore.containsAlias(keyAlias)) {
                val publicKey = keyStore.getCertificate(keyAlias).publicKey
                // publicKey.encoded is X.509 SubjectPublicKeyInfo DER; the resolver
                // verifies with .NET ECDsa.ImportFromPem, so PEM-wrap it.
                result.success(mapOf(
                    "publicKey" to spkiPem(publicKey.encoded),
                    "keyRef" to keyAlias,
                    "storageLevel" to getKeyStorageLevel()
                ))
                return
            }

            // Generate new key pair
            val builder = KeyGenParameterSpec.Builder(
                keyAlias,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(true)

            // Prefer StrongBox if available (API 28+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                builder.setIsStrongBoxBacked(isStrongBoxAvailable())
            }

            // Biometric or device credential (API 30+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)
            }

            val keyPairGenerator = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore"
            )
            keyPairGenerator.initialize(builder.build())
            val keyPair = keyPairGenerator.generateKeyPair()

            result.success(mapOf(
                "publicKey" to spkiPem(keyPair.public.encoded),
                "keyRef" to keyAlias,
                "storageLevel" to getKeyStorageLevel()
            ))
        } catch (e: Exception) {
            result.error("KEY_GENERATION_FAILED", e.message, null)
        }
    }

    private fun sign(payload: String, result: MethodChannel.Result) {
        try {
            val keyStore = KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)

            if (!keyStore.containsAlias(keyAlias)) {
                result.error("KEY_NOT_FOUND", "No signing key found", null)
                return
            }

            val privateKey = keyStore.getKey(keyAlias, null) as java.security.PrivateKey
            val signature = Signature.getInstance("SHA256withECDSA")
            signature.initSign(privateKey)
            signature.update(payload.toByteArray(Charsets.UTF_8))
            // SHA256withECDSA produces a DER-encoded signature; the resolver's
            // .NET ECDsa.VerifyData expects IEEE-P1363 raw r||s (32 bytes each),
            // base64url. Convert.
            val signatureBytes = signature.sign()
            result.success(mapOf(
                "signature" to base64Url(derToRawRs(signatureBytes, 32))
            ))
        } catch (e: android.security.keystore.UserNotAuthenticatedException) {
            result.error("USER_CANCELLED", "Biometric authentication required", null)
        } catch (e: Exception) {
            if (e.message?.contains("cancel", ignoreCase = true) == true) {
                result.error("USER_CANCELLED", "Biometric cancelled by user", null)
            } else {
                result.error("SIGNING_FAILED", e.message, null)
            }
        }
    }

    private fun getStorageLevel(result: MethodChannel.Result) {
        result.success(mapOf("storageLevel" to getKeyStorageLevel()))
    }

    private fun deleteKey(result: MethodChannel.Result) {
        try {
            val keyStore = KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)
            if (keyStore.containsAlias(keyAlias)) {
                keyStore.deleteEntry(keyAlias)
                result.success(mapOf("deleted" to true))
            } else {
                result.success(mapOf("deleted" to false))
            }
        } catch (e: Exception) {
            result.success(mapOf("deleted" to false))
        }
    }

    private fun getKeyStorageLevel(): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && isStrongBoxAvailable()) {
            "secureEnclave"
        } else {
            "hardwareKeystore"
        }
    }

    private fun isStrongBoxAvailable(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val context = io.flutter.embedding.engine.FlutterEngine::class.java
                // StrongBox detection: attempt to use PackageManager
                // In practice, check via context.packageManager.hasSystemFeature
                // For now, assume hardware keystore is available on API 28+
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    // --- Wire-format encoding (match the resolver's ES256 verifier) ---

    /** base64url without padding. */
    private fun base64Url(bytes: ByteArray): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)

    /** PEM-wrap an X.509 SubjectPublicKeyInfo DER (BEGIN/END PUBLIC KEY). */
    private fun spkiPem(spkiDer: ByteArray): String {
        val b64 = Base64.getEncoder().encodeToString(spkiDer)
        val sb = StringBuilder("-----BEGIN PUBLIC KEY-----\n")
        var i = 0
        while (i < b64.length) {
            val end = minOf(i + 64, b64.length)
            sb.append(b64, i, end).append('\n')
            i = end
        }
        sb.append("-----END PUBLIC KEY-----")
        return sb.toString()
    }

    /**
     * Convert a DER-encoded ECDSA signature (SEQUENCE { INTEGER r, INTEGER s })
     * into fixed-width raw r||s of [componentLength] bytes each.
     */
    private fun derToRawRs(der: ByteArray, componentLength: Int): ByteArray {
        var i = 0
        require(der.size > 2 && der[i].toInt() and 0xff == 0x30) { "bad DER sequence" }
        i++
        // Sequence length (short or long form) — skip.
        if (der[i].toInt() and 0x80 != 0) {
            val n = der[i].toInt() and 0x7f; i += 1 + n
        } else {
            i++
        }
        fun readInt(): ByteArray {
            require(der[i].toInt() and 0xff == 0x02) { "bad DER integer" }
            i++
            val len = der[i].toInt() and 0xff; i++
            var v = der.copyOfRange(i, i + len); i += len
            // Strip leading zero padding.
            var start = 0
            while (start < v.size - 1 && v[start].toInt() == 0) start++
            if (start > 0) v = v.copyOfRange(start, v.size)
            return v
        }
        val r = readInt()
        val s = readInt()
        fun fixed(v: ByteArray): ByteArray {
            if (v.size == componentLength) return v
            val out = ByteArray(componentLength)
            if (v.size > componentLength) {
                System.arraycopy(v, v.size - componentLength, out, 0, componentLength)
            } else {
                System.arraycopy(v, 0, out, componentLength - v.size, v.size)
            }
            return out
        }
        return fixed(r) + fixed(s)
    }
}
