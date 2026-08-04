using System.Collections.Concurrent;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.DotNet.Notifications;

public sealed class SseNotificationChannel : INotificationChannel
{
    private readonly ConcurrentDictionary<Guid, ConcurrentBag<SseConnection>> _connections = new();

    public async Task NotifyDevicesAsync(Guid userId, string eventType, string payload, CancellationToken cancellationToken = default)
    {
        if (!_connections.TryGetValue(userId, out var connections))
            return;

        var deadConnections = new List<SseConnection>();

        foreach (var connection in connections)
        {
            try
            {
                await connection.WriteEventAsync(eventType, payload);
            }
            catch (Exception)
            {
                deadConnections.Add(connection);
            }
        }

        foreach (var dead in deadConnections)
        {
            RemoveConnection(userId, dead);
        }
    }

    public bool HasActiveConnections(Guid userId)
    {
        return _connections.TryGetValue(userId, out var connections) && !connections.IsEmpty;
    }

    public void AddConnection(Guid userId, SseConnection connection)
    {
        var bag = _connections.GetOrAdd(userId, _ => new ConcurrentBag<SseConnection>());
        bag.Add(connection);
    }

    public void RemoveConnection(Guid userId, SseConnection connection)
    {
        if (_connections.TryGetValue(userId, out var bag))
        {
            var remaining = new ConcurrentBag<SseConnection>(bag.Where(c => c != connection));
            _connections.TryUpdate(userId, remaining, bag);
        }
    }

    /// <summary>
    /// Sends a heartbeat comment to all connected clients to keep connections alive
    /// through proxies and load balancers that kill idle SSE streams.
    /// </summary>
    public async Task BroadcastHeartbeatAsync()
    {
        foreach (var (userId, connections) in _connections)
        {
            var deadConnections = new List<SseConnection>();

            foreach (var connection in connections)
            {
                try
                {
                    await connection.WriteCommentAsync("ping");
                }
                catch (Exception)
                {
                    deadConnections.Add(connection);
                }
            }

            foreach (var dead in deadConnections)
            {
                RemoveConnection(userId, dead);
            }
        }
    }
}

public sealed class SseConnection
{
    private readonly Stream _stream;

    public Guid DeviceId { get; }

    public SseConnection(Guid deviceId, Stream stream)
    {
        DeviceId = deviceId;
        _stream = stream;
    }

    public async Task WriteEventAsync(string eventType, string data)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes($"event: {eventType}\ndata: {data}\n\n");
        await _stream.WriteAsync(bytes);
        await _stream.FlushAsync();
    }

    public async Task WriteCommentAsync(string comment)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes($": {comment}\n\n");
        await _stream.WriteAsync(bytes);
        await _stream.FlushAsync();
    }
}
