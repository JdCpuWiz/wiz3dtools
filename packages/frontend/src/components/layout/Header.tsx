import React from 'react';
import { DarkModeToggle } from '../common/DarkModeToggle';

export const Header: React.FC = () => {
  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/wiz3d_prints_logo.png"
              alt="Wiz3D Prints Logo"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WizQueue</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">3D Printing Queue Manager</p>
            </div>
          </div>
          <DarkModeToggle />
        </div>
      </div>
    </header>
  );
};
