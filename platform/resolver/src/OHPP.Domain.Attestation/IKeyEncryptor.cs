namespace OHPP.Domain.Attestation;

public interface IKeyEncryptor
{
    string Encrypt(string plainText);
    string Decrypt(string cipherText);
}
