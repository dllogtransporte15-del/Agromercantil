import React from 'react';

interface FormattedObservationsProps {
  text?: string;
  className?: string;
}

/**
 * Converte URLs e links em texto para links âncora clicáveis seguros.
 */
export const FormattedObservations: React.FC<FormattedObservationsProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Regex para encontrar URLs (http, https, maps.app.goo.gl, etc.)
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const parts = text.split(urlRegex);

  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline font-medium hover:text-blue-800 dark:hover:text-blue-300 break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};

export default FormattedObservations;
