import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  filterText: string;
}

interface SearchableSelectProps {
  label?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ label, options, value, onChange, placeholder = "Selecione...", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.filterText.toLowerCase().includes(searchTerm.toLowerCase()));

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`space-y-1 relative ${className}`} ref={dropdownRef}>
      {label && <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm hover:border-primary/50 dark:hover:border-primary/50 dark:bg-gray-800/60 backdrop-blur-sm focus:ring-2 focus:ring-primary outline-none text-left bg-white/60 transition-all duration-200"
      >
        <span className="truncate flex-1 pr-2 text-gray-700 dark:text-gray-300 font-medium">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-gray-100/50 dark:border-gray-700/50 relative bg-gray-50/50 dark:bg-gray-900/30">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full pl-9 pr-3 py-2 text-sm border-none bg-white dark:bg-gray-900 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-primary text-gray-700 dark:text-gray-200 transition-all"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            <button
              type="button"
              className={`w-full text-left px-3 py-2 text-sm rounded cursor-pointer ${value === '' ? 'bg-primary text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchTerm('');
              }}
            >
              -- Nenhum --
            </button>
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-2 text-sm text-gray-500 text-center">Nenhum resultado</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`w-full text-left px-3 py-2 text-sm rounded cursor-pointer truncate ${value === option.value ? 'bg-primary/10 text-primary dark:bg-primary/20 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  title={option.label}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
