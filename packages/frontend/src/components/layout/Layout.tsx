import React from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
  onUploadClick?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onUploadClick }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header onUploadClick={onUploadClick} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
          WizQueue v1.0.0 - 3D Printing Queue Generator
        </div>
      </footer>
    </div>
  );
};
