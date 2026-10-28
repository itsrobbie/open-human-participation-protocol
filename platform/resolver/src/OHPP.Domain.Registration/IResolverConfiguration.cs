namespace OHPP.Domain.Registration;

public interface IResolverConfiguration
{
    string BaseUrl { get; }

    /// <summary>
    /// Max app registrations one user may complete per rolling hour. Guards the
    /// registration ceremony against abuse. Defaults to 10; raised only in the
    /// E2E stack, where one demo user packs a suite's worth of registrations
    /// into minutes against a resolver that is never restarted mid-run.
    /// </summary>
    int MaxRegistrationsPerHour { get; }
}
