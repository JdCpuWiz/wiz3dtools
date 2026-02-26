import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface HeaderProps {
  onUploadClick?: () => void;
}

// Nav order: Customers → Products → Invoices → Queue
const navItems = [
  { to: '/customers', label: 'Customers', exact: false },
  { to: '/products', label: 'Products', exact: false },
  { to: '/invoices', label: 'Invoices', exact: false },
  { to: '/', label: 'Queue', exact: true },
];

export const Header: React.FC<HeaderProps> = ({ onUploadClick }) => {
  const location = useLocation();
  const isQueueView = location.pathname === '/';

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
              <h1 className="text-xl font-bold text-iron-50 leading-tight">WizQueue</h1>
              <p className="text-xs text-iron-400">3D Printing Queue Manager</p>
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
