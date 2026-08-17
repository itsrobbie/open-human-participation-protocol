import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { UserManager, type User } from 'oidc-client-ts';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userManager, setUserManager] = useState<UserManager | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/.well-known/ohpp/auth-config');
        const config = await res.json();

        const mgr = new UserManager({
          authority: config.authority,
          client_id: config.clientId,
          redirect_uri: `${window.location.origin}/auth/callback`,
          post_logout_redirect_uri: window.location.origin,
          response_type: 'code',
          scope: 'openid profile',
          automaticSilentRenew: true,
          silent_redirect_uri: `${window.location.origin}/auth/silent`,
          // Provide metadata directly to avoid OIDC discovery returning internal Docker URLs
          metadata: {
            issuer: config.authority,
            authorization_endpoint: `${config.authority}/protocol/openid-connect/auth`,
            token_endpoint: `${config.authority}/protocol/openid-connect/token`,
            userinfo_endpoint: `${config.authority}/protocol/openid-connect/userinfo`,
            end_session_endpoint: `${config.authority}/protocol/openid-connect/logout`,
            jwks_uri: `${config.authority}/protocol/openid-connect/certs`,
          },
        });

        setUserManager(mgr);

        // Handle callback
        if (location.pathname === '/auth/callback') {
          const cbUser = await mgr.signinRedirectCallback();
          setUser(cbUser);
          setIsLoading(false);
          navigate('/', { replace: true });
          return;
        }

        // Check existing session
        const existingUser = await mgr.getUser();
        if (existingUser && !existingUser.expired) {
          setUser(existingUser);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(() => {
    userManager?.signinRedirect();
  }, [userManager]);

  const logout = useCallback(() => {
    userManager?.signoutRedirect();
  }, [userManager]);

  const getAccessToken = useCallback(() => {
    return user?.access_token ?? null;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user && !user.expired, isLoading, login, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}
