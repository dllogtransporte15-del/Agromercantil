
import React from 'react';

interface HeaderProps {
  title: string | React.ReactNode;
  children?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, children }) => {
  return (
    <div className="flex items-center justify-between mb-8">
      {typeof title === 'string' ? (
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{title}</h1>
      ) : (
        title
      )}
      <div className="flex items-center space-x-4">
        {children}
      </div>
    </div>
  );
};

export default Header;
