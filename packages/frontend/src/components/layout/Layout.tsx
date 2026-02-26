import React from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: React.ReactNode;
  onUploadClick?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onUploadClick }) => {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0a0a0a' }}>
      <Header onUploadClick={onUploadClick} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer
        className="py-4 border-t"
        style={{ backgroundColor: '#1a1a1a', borderColor: '#2d2d2d' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-iron-400">
          WizQueue — Wiz3D Prints Queue Manager
        </div>
      </footer>
    </div>
  );
};
