import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Package, ShoppingBag, Settings, Menu, X, LogOut, Moon, Sun, Search } from 'lucide-react';
import { useAuth } from '../lib/auth.tsx';
import { useDarkMode } from '../hooks/useDarkMode.ts';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/purchases', icon: ShoppingBag, label: 'Purchases' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle } = useDarkMode();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip to content */}
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-neon-dark-nav text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2 shrink-0" data-testid="nav-logo">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                N
              </div>
              <span className="font-semibold text-lg hidden sm:block">NeonMarket</span>
            </NavLink>

            {/* Search bar (desktop) */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  data-testid="search-input"
                />
              </div>
            </form>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Right section */}
            <div className="flex items-center gap-2 ml-auto md:ml-0">
              <button onClick={toggle} className="p-2 text-slate-400 hover:text-white rounded-lg" aria-label="Toggle dark mode" data-testid="dark-mode-toggle">
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-700">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-xs font-medium">
                  {user?.profile?.name?.charAt(0) ?? '?'}
                </div>
                <span className="text-sm text-slate-300 max-w-24 truncate">{user?.profile?.name ?? 'User'}</span>
                <button onClick={logout} className="p-1.5 text-slate-400 hover:text-white" aria-label="Logout" data-testid="logout-button">
                  <LogOut size={16} />
                </button>
              </div>
              {/* Mobile hamburger */}
              <button className="md:hidden p-2 text-slate-300" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Open menu" data-testid="hamburger-menu">
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-700 bg-neon-dark-nav pb-4">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-400"
                  data-testid="mobile-search-input"
                />
              </div>
            </form>
            <nav className="px-2 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                      isActive ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="ohpp.marketplace.nav-item"
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="px-4 pt-3 border-t border-slate-700 mt-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-xs font-medium">
                {user?.profile?.name?.charAt(0) ?? '?'}
              </div>
              <span className="text-sm text-slate-300 flex-1">{user?.profile?.name ?? 'User'}</span>
              <button onClick={logout} className="text-sm text-slate-400 hover:text-white" data-testid="mobile-logout">
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
