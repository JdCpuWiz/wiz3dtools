import React from 'react';
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

export const Header: React.FC<HeaderProps> = ({ onUploadClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(user?.role === 'admin' ? [{ to: '/admin/users', label: 'Admin', exact: false }] : []),
  ];
  const isQueueView = location.pathname === '/queue';

  const handleLogout = () => {
    logout();
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
              <p className="text-xs text-iron-400">3D Printing Business Suite</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav
            className="hidden sm:flex items-center gap-1 p-1 rounded-xl"
            style={{ background: 'rgba(10,10,10,0.6)' }}
          >
            {navItems.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `px-5 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive ? 'nav-tab-active' : 'nav-tab-inactive'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
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
                <button onClick={handleLogout} className="btn-secondary btn-sm">Sign Out</button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Nav */}
        <nav
          className="sm:hidden flex gap-1 mt-3 p-1 rounded-xl"
          style={{ background: 'rgba(10,10,10,0.6)' }}
        >
          {navItems.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex-1 text-center py-1.5 text-xs font-medium transition-all duration-200 ${
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
