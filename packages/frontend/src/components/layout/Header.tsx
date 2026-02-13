import React from 'react';
import { DarkModeToggle } from '../common/DarkModeToggle';

interface HeaderProps {
  onUploadClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onUploadClick }) => {
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
          <div className="flex items-center gap-4">
            {onUploadClick && (
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
      </div>
    </header>
  );
};
