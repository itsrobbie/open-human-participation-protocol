namespace OHPP.Protocol;

public enum RequestType
{
    Select,
    Multiselect,
    Text,
    Number,
    Date,
    DateTime,
    Signature
}

public enum RequestStatus
{
    Pending,
    Resolved,
    Expired,
    Cancelled
}

public enum ResolutionMethod
{
    Direct,
    AutoApproved,
    Delegated
}

public enum SignatureAlgorithm
{
    ES256,
    EdDSA
}
