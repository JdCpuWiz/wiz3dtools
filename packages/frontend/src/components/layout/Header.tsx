import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { DarkModeToggle } from '../common/DarkModeToggle';

interface HeaderProps {
  onUploadClick?: () => void;
}

const navItems = [
  { to: '/', label: 'Queue', exact: true },
  { to: '/invoices', label: 'Invoices', exact: false },
  { to: '/customers', label: 'Customers', exact: false },
];

export const Header: React.FC<HeaderProps> = ({ onUploadClick }) => {
  const location = useLocation();
  const isQueueView = location.pathname === '/';

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/wiz3d_prints_logo.png"
              alt="Wiz3D Prints Logo"
              className="h-16 w-auto object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WizQueue</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">3D Printing Queue Manager</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {navItems.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `px-5 py-2 rounded-md font-medium transition-colors text-sm ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {isQueueView && onUploadClick && (
              <button
                onClick={onUploadClick}
                className="px-6 py-2.5 rounded-lg font-medium transition-colors text-base bg-primary-600 text-white hover:bg-primary-700 dark:bg-white dark:text-black dark:hover:bg-gray-100"
              >
                Upload Invoice
              </button>
            )}
            <DarkModeToggle />
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="sm:hidden flex gap-1 mt-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {navItems.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex-1 text-center px-2 py-1.5 rounded-md font-medium transition-colors text-sm ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
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
