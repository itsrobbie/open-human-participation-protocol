import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Link2Off, QrCode, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.ts';

interface OhppStatus {
  connected: boolean;
}

interface ChallengeResponse {
  uri: string;
  challengeId: string;
  expiresAt: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: ohppStatus } = useQuery({
    queryKey: ['ohpp-status'],
    queryFn: () => api.get<OhppStatus>('/api/ohpp/status'),
  });

  const challengeMutation = useMutation({
    mutationFn: () => api.post<ChallengeResponse>('/api/ohpp/generate-challenge'),
    onSuccess: () => {
      toast.success('Challenge generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete('/api/ohpp/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ohpp-status'] });
      toast.success('OHPP disconnected');
      challengeMutation.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isConnected = ohppStatus?.connected ?? false;
  const challenge = challengeMutation.data;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* OHPP Connection */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          {isConnected ? (
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Link2 size={20} className="text-green-600" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
              <Link2Off size={20} className="text-slate-400" />
            </div>
          )}
          <div>
            <h2 className="font-semibold">OHPP Connection</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isConnected ? 'Connected - purchases will be verified via OHPP' : 'Not connected'}
            </p>
          </div>
          <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`} data-testid="ohpp-status">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {isConnected ? (
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
            data-testid="disconnect-button"
          >
            {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
          </button>
        ) : (
          <div>
            {!challenge && (
              <button
                onClick={() => challengeMutation.mutate()}
                disabled={challengeMutation.isPending}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-all"
                data-testid="generate-challenge-button"
              >
                {challengeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                Generate Connection Challenge
              </button>
            )}

            {challenge && (
              <div className="mt-4 bg-slate-50 dark:bg-slate-900 rounded-lg p-4" data-testid="challenge-display">
                <p className="text-sm font-medium mb-2">Challenge URI</p>
                <code className="block text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 break-all" data-testid="challenge-uri">
                  {challenge.uri}
                </code>
                <p className="text-xs text-slate-500 mt-2">
                  Expires: {new Date(challenge.expiresAt).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
