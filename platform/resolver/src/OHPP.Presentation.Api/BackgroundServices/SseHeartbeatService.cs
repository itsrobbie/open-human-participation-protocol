using OHPP.Infrastructure.DotNet.Notifications;

namespace OHPP.Presentation.Api.BackgroundServices;

/// <summary>
/// Sends periodic heartbeat comments to all connected SSE clients.
/// Prevents proxies/load balancers from killing idle connections.
/// </summary>
public sealed class SseHeartbeatService : BackgroundService
{
    private readonly SseNotificationChannel _channel;
    private readonly ILogger<SseHeartbeatService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(15);

    public SseHeartbeatService(
        SseNotificationChannel channel,
        ILogger<SseHeartbeatService> logger)
    {
        _channel = channel;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                _channel.BroadcastHeartbeat();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending SSE heartbeat");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }
}
