/**
 * Formata um CPF no padrão: 000.000.000-00
 */
export const formatCPF = (value: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '').slice(0, 11);
  let formatted = cleaned;
  if (cleaned.length > 9) {
    formatted = cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2}).*/, '$1.$2.$3-$4');
  } else if (cleaned.length > 6) {
    formatted = cleaned.replace(/^(\d{3})(\d{3})(\d{1,3}).*/, '$1.$2.$3');
  } else if (cleaned.length > 3) {
    formatted = cleaned.replace(/^(\d{3})(\d{1,3}).*/, '$1.$2');
  }
  return formatted;
};

/**
 * Formata um CNPJ no padrão: 00.000.000/0000-00
 */
export const formatCNPJ = (value: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '').slice(0, 14);
  let formatted = cleaned;
  if (cleaned.length > 12) {
    formatted = cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2}).*/, '$1.$2.$3/$4-$5');
  } else if (cleaned.length > 8) {
    formatted = cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4}).*/, '$1.$2.$3/$4');
  } else if (cleaned.length > 5) {
    formatted = cleaned.replace(/^(\d{2})(\d{3})(\d{1,3}).*/, '$1.$2.$3');
  } else if (cleaned.length > 2) {
    formatted = cleaned.replace(/^(\d{2})(\d{1,3}).*/, '$1.$2');
  }
  return formatted;
};

/**
 * Aplica máscara de CPF ou CNPJ de acordo com o tamanho do valor digitado
 */
export const formatCpfCnpj = (value: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 11) {
    return formatCPF(cleaned);
  }
  return formatCNPJ(cleaned);
};

/**
 * Formata telefone no padrão (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export const formatPhone = (value: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '').slice(0, 11);
  let formatted = cleaned;
  
  if (cleaned.length > 10) {
    // 11 dígitos: (XX) XXXXX-XXXX
    formatted = cleaned.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  } else if (cleaned.length > 6) {
    // 10 dígitos: (XX) XXXX-XXXX (also applies partially when typing >6 digits)
    formatted = cleaned.replace(/^(\d{2})(\d{4})(\d{1,4}).*/, '($1) $2-$3');
  } else if (cleaned.length > 2) {
    // Parte do número: (XX) XXXX
    formatted = cleaned.replace(/^(\d{2})(\d{1,5}).*/, '($1) $2');
  } else if (cleaned.length > 0) {
    // Apenas DDD: (XX
    formatted = cleaned.replace(/^(\d{1,2})/, '($1');
  }
  
  return formatted;
};

/**
 * Formata cidade e estado, ex: "cumari go" -> "Cumari, GO"
 */
export const formatCityState = (value: string): string => {
  if (!value) return '';
  
  let cleanValue = value.trim().replace(/\s+/g, ' ');
  
  // Extract state code at the end (2 letters)
  const stateMatch = cleanValue.match(/(.+?)(?:,|\s-|\s)+([a-zA-Z]{2})$/);
  
  let cityPart = cleanValue;
  let statePart = '';
  
  if (stateMatch) {
    cityPart = stateMatch[1].trim();
    statePart = stateMatch[2].toUpperCase();
  }

  const exceptions = ['de', 'da', 'do', 'das', 'dos'];
  const formattedCity = cityPart.split(' ').map((word, index) => {
    const lowerWord = word.toLowerCase();
    if (index > 0 && exceptions.includes(lowerWord)) {
      return lowerWord;
    }
    return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
  }).join(' ');

  if (statePart) {
    return `${formattedCity}, ${statePart}`;
  }
  
  return formattedCity;
};
