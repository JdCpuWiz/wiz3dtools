import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onUploadClick?: () => void;
}

const BASE_NAV_ITEMS = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/customers', label: 'Customers', exact: false },
  { to: '/products', label: 'Products', exact: false },
  { to: '/invoices', label: 'Invoices', exact: false },
  { to: '/queue', label: 'Queue', exact: false },
];

const ADMIN_NAV_ITEMS = [
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/colors', label: 'Colors' },
  { to: '/admin/printers', label: 'Printers' },
  { to: '/admin/manufacturers', label: 'Manufacturers' },
  { to: '/filament', label: 'Filament' },
];

export const Header: React.FC<HeaderProps> = ({ onUploadClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [adminOpen, setAdminOpen] = useState(false);
  const adminRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAdminActive = ADMIN_NAV_ITEMS.some((item) => location.pathname.startsWith(item.to));
  const isQueueView = location.pathname === '/queue';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header
      style={{
        background: 'linear-gradient(to bottom, rgba(74,74,74,0.9), rgba(45,45,45,0.9))',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 8px rgb(0 0 0 / 0.5)',
        borderBottom: '1px solid #2d2d2d',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src="/wiz3d_prints_logo.png"
              alt="Wiz3D Prints Logo"
              className="h-14 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-iron-50 leading-tight">Wiz3d Tools</h1>
              <p className="text-xs text-iron-300">3D Printing Business Suite</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav
            className="hidden sm:flex items-center gap-0.5 p-1 rounded-xl"
            style={{ background: 'rgba(10,10,10,0.6)' }}
          >
            {BASE_NAV_ITEMS.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive ? 'nav-tab-active' : 'nav-tab-inactive'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}

            {/* Admin dropdown */}
            {user?.role === 'admin' && (
              <div ref={adminRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setAdminOpen((v) => !v)}
                  className={`px-4 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1 ${isAdminActive ? 'nav-tab-active' : 'nav-tab-inactive'}`}
                >
                  Admin
                  <svg style={{ width: 12, height: 12, transition: 'transform 0.15s', transform: adminOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {adminOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      minWidth: 160,
                      background: 'linear-gradient(to bottom, #3a3a3a, #2d2d2d)',
                      border: '1px solid #4a4a4a',
                      borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      zIndex: 100,
                      overflow: 'hidden',
                    }}
                  >
                    {ADMIN_NAV_ITEMS.map(({ to, label }) => (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={() => setAdminOpen(false)}
                        className={({ isActive }) =>
                          `block px-4 py-2.5 text-sm font-medium transition-colors ${
                            isActive ? 'text-[#ff9900] bg-[#3a1f00]' : 'text-[#d1d5db] hover:text-[#ff9900] hover:bg-[#2a2a2a]'
                          }`
                        }
                      >
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3 shrink-0">
            {isQueueView && onUploadClick && (
              <button
                onClick={onUploadClick}
                className="btn-primary px-5 py-2 text-sm"
              >
                Upload Invoice
              </button>
            )}
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#9ca3af] hidden sm:inline">{user.username}</span>
                <span className="text-xs text-iron-300 hidden sm:inline">v{__APP_VERSION__}</span>
                <button onClick={handleLogout} className="btn-secondary btn-sm">Sign Out</button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Nav */}
        <nav
          className="sm:hidden flex gap-1 mt-3 p-1 rounded-xl overflow-x-auto"
          style={{ background: 'rgba(10,10,10,0.6)' }}
        >
          {BASE_NAV_ITEMS.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex-shrink-0 text-center px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  isActive ? 'nav-tab-active' : 'nav-tab-inactive'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
          {user?.role === 'admin' && ADMIN_NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-shrink-0 text-center px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  isActive ? 'nav-tab-active' : 'nav-tab-inactive'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
};
