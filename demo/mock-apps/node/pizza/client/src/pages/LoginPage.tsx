import { useAuth } from '../lib/auth.tsx';
import { Navigate } from 'react-router-dom';

export function LoginPage() {
  const { isAuthenticated, login, isLoading } = useAuth();

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl p-8 text-center">
          {/* Logo */}
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">S&D</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white mb-1">Slice & Dice Pizza</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mb-8">Sign in to order your favourites</p>

          <button
            onClick={login}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            data-testid="login-button"
          >
            Sign In
          </button>

          <p className="mt-6 text-xs text-stone-400">Powered by OHPP</p>
        </div>
      </div>
    </div>
  );
}
