namespace OHPP.Domain.Attestation;

public interface ISigner
{
    string Sign(string payload, string privateKeyPem);
}

public interface ISignatureVerifier
{
    bool Verify(string payload, string signature, string publicKeyPem);
}
