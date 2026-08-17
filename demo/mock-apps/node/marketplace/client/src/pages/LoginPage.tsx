import { useAuth } from '../lib/auth.tsx';
import { Navigate } from 'react-router-dom';

export function LoginPage() {
  const { isAuthenticated, login, isLoading } = useAuth();

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
          {/* Logo */}
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">N</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">NeonMarket</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Sign in to start shopping</p>

          <button
            onClick={login}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium py-3 px-4 rounded-lg transition-all"
            data-testid="login-button"
          >
            Sign In
          </button>

          <p className="mt-6 text-xs text-slate-400">Powered by OHPP</p>
        </div>
      </div>
    </div>
  );
}
