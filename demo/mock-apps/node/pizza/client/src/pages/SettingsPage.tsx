import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shield, ShieldCheck, Unlink } from 'lucide-react';
import { api } from '../lib/api.ts';

interface OhppStatus { connected: boolean }
interface ChallengeResponse { uri: string; challengeId: string; expiresAt: string }

export function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: ohppStatus, isLoading } = useQuery({
    queryKey: ['ohpp-status'],
    queryFn: () => api.get<OhppStatus>('/api/ohpp/status'),
    refetchInterval: 5000,
  });

  const generateChallenge = useMutation({
    mutationFn: () => api.post<ChallengeResponse>('/api/ohpp/generate-challenge'),
  });

  const disconnect = useMutation({
    mutationFn: () => api.delete<OhppStatus>('/api/ohpp/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ohpp-status'] });
      toast.success('OHPP disconnected');
    },
  });

  const isConnected = ohppStatus?.connected ?? false;

  if (isLoading) return <div className="animate-pulse h-40 bg-stone-100 dark:bg-stone-800 rounded-lg" />;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          {isConnected ? (
            <ShieldCheck size={24} className="text-green-600" />
          ) : (
            <Shield size={24} className="text-stone-400" />
          )}
          <div>
            <h2 className="font-semibold">OHPP Connection</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {isConnected ? 'Connected to your Resolver' : 'Not connected'}
            </p>
          </div>
          <span
            className={`ml-auto text-xs font-medium px-2 py-1 rounded ${
              isConnected ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-stone-100 dark:bg-stone-700 text-stone-500'
            }`}
            data-testid="ohpp-connection-status"
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {!isConnected ? (
          <div>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
              Connect your OHPP provider to enable order confirmations and the OHPP Pizza experience.
            </p>

            {!generateChallenge.data ? (
              <button
                onClick={() => generateChallenge.mutate()}
                disabled={generateChallenge.isPending}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                data-testid="connect-ohpp-button"
              >
                {generateChallenge.isPending ? 'Generating...' : 'Connect OHPP'}
              </button>
            ) : (
              <div className="space-y-3" data-testid="challenge-display">
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  Open this link on your device or scan the QR code:
                </p>
                <div className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-3">
                  <code className="text-xs break-all" data-testid="challenge-uri">
                    {generateChallenge.data.uri}
                  </code>
                </div>
                <p className="text-xs text-stone-400">
                  Expires: {new Date(generateChallenge.data.expiresAt).toLocaleTimeString()}
                </p>
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  Waiting for connection...
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-700">
              <h3 className="font-medium text-sm mb-2">How it works</h3>
              <ol className="text-sm text-stone-500 dark:text-stone-400 space-y-1 list-decimal list-inside">
                <li>Click "Connect OHPP" to generate a challenge</li>
                <li>Open the link on your OHPP device</li>
                <li>Approve the connection on your device</li>
                <li>Future orders will require your confirmation</li>
              </ol>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
              Your orders require OHPP confirmation before processing. You can also use the OHPP Pizza feature.
            </p>
            <button
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium"
              data-testid="disconnect-ohpp-button"
            >
              <Unlink size={16} />
              {disconnect.isPending ? 'Disconnecting...' : 'Disconnect OHPP'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
