using OHPP.Domain.Participation;

namespace OHPP.Presentation.Api.BackgroundServices;

public sealed class ExpiryEnforcementBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ExpiryEnforcementBackgroundService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(30);

    public ExpiryEnforcementBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<ExpiryEnforcementBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IExpiryEnforcementService>();
                var count = await service.EnforceExpiredRequestsAsync(stoppingToken);

                if (count > 0)
                    _logger.LogInformation("Expired {Count} pending requests", count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error during expiry enforcement");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }
}
