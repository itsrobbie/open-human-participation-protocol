namespace OHPP.Protocol;

public static class ProtocolConstants
{
    public const string Version = "1.0";

    public const string UriScheme = "ohpp";
    public const string RegisterAction = "register";
    public const string ChallengeParam = "challenge";

    public const string WellKnownMetadataPath = "/.well-known/ohpp/metadata";
    public const string WellKnownAppMetadataPath = "/.well-known/ohpp/app-metadata";

    public const string DeviceTokenPrefix = "ohpp_dev_";
    public const string AppTokenPrefix = "ohpp_app_";

    public static class MaxLengths
    {
        public const int Summary = 200;
        public const int Description = 2000;
        public const int Rationale = 500;
        public const int Category = 50;
        public const int OptionLabel = 100;
        public const int TransactionLabel = 100;
    }

    public static class MinCounts
    {
        public const int OptionsForSelect = 2;
    }
}
