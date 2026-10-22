import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, UtensilsCrossed, ShoppingCart, ClipboardList, Settings, Menu, X, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../lib/auth.tsx';
import { getCart } from '../lib/cart.ts';
import { useDarkMode } from '../hooks/useDarkMode.ts';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu' },
  { to: '/orders', icon: ClipboardList, label: 'Orders' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle } = useDarkMode();
  const cartCount = getCart().length;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Skip to content */}
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" data-testid="ohpp.pizza.sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-brand-dark-nav text-white transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-stone-800">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              S&D
            </div>
            <span className="font-semibold text-lg">Slice & Dice</span>
            <button
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              data-testid="sidebar-close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-red-600 text-white' : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Cart button */}
          <div className="px-3 pb-2">
            <button
              onClick={() => { navigate('/cart'); setSidebarOpen(false); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
              data-testid="nav-cart"
            >
              <ShoppingCart size={18} />
              Cart
              {cartCount > 0 && (
                <span className="ml-auto bg-red-600 text-white text-xs rounded-full px-2 py-0.5" data-testid="cart-badge">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* User section */}
          <div className="px-3 pb-4 border-t border-stone-800 pt-3">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center text-xs font-medium">
                {user?.profile?.name?.charAt(0) ?? '?'}
              </div>
              <span className="text-sm text-stone-300 truncate flex-1">{user?.profile?.name ?? 'User'}</span>
              <button onClick={toggle} className="p-1 text-stone-400 hover:text-white" aria-label="Toggle dark mode" data-testid="dark-mode-toggle">
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button onClick={logout} className="p-1 text-stone-400 hover:text-white" aria-label="Logout" data-testid="logout-button">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" data-testid="hamburger-menu">
            <Menu size={24} />
          </button>
          <span className="font-semibold">Slice & Dice Pizza</span>
        </header>

        <div className="p-4 lg:p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
