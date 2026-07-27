using System.Collections.Concurrent;
using OHPP.Domain.Participation;

namespace OHPP.Infrastructure.DotNet.Notifications;

public sealed class SseNotificationChannel : INotificationChannel
{
    private readonly ConcurrentDictionary<Guid, ConcurrentBag<SseConnection>> _connections = new();

    public Task NotifyDevicesAsync(Guid userId, string eventType, string payload, CancellationToken cancellationToken = default)
    {
        if (!_connections.TryGetValue(userId, out var connections))
            return Task.CompletedTask;

        var deadConnections = new List<SseConnection>();

        foreach (var connection in connections)
        {
            try
            {
                connection.WriteEvent(eventType, payload);
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

        return Task.CompletedTask;
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
    public void BroadcastHeartbeat()
    {
        foreach (var (userId, connections) in _connections)
        {
            var deadConnections = new List<SseConnection>();

            foreach (var connection in connections)
            {
                try
                {
                    connection.WriteComment("ping");
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
    private readonly object _lock = new();

    public Guid DeviceId { get; }

    public SseConnection(Guid deviceId, Stream stream)
    {
        DeviceId = deviceId;
        _stream = stream;
    }

    public void WriteEvent(string eventType, string data)
    {
        lock (_lock)
        {
            var writer = new StreamWriter(_stream, leaveOpen: true);
            writer.Write($"event: {eventType}\n");
            writer.Write($"data: {data}\n\n");
            writer.Flush();
        }
    }

    /// <summary>
    /// Writes an SSE comment line (: comment\n\n). Used for heartbeats.
    /// Comments are ignored by SSE clients but keep the connection alive.
    /// </summary>
    public void WriteComment(string comment)
    {
        lock (_lock)
        {
            var writer = new StreamWriter(_stream, leaveOpen: true);
            writer.Write($": {comment}\n\n");
            writer.Flush();
        }
    }
}
