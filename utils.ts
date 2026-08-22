export const formatId = (num: number, prefix: string): string => {
  return `${prefix}-${String(num).padStart(3, '0')}`;
};

const numberToWordsPtBr = (num: number, gender: 'm' | 'f' = 'm'): string => {
  if (num === 0) return 'zero';

  const unitsM = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const unitsF = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const units = gender === 'm' ? unitsM : unitsF;
  
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const convertThreeDigits = (n: number, currentGender: 'm' | 'f'): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    
    let res = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;

    if (h > 0) res += hundreds[h];
    if (h > 0 && remainder > 0) res += ' e ';

    if (t === 1) {
      res += teens[u];
    } else {
      if (t > 1) res += tens[t];
      if (t > 1 && u > 0) res += ' e ';
      if (u > 0 || (h === 0 && t === 0)) {
          if (!(h > 0 && t === 0 && u === 0)) {
              res += (currentGender === 'm' ? unitsM[u] : unitsF[u]);
          }
      }
    }
    return res;
  };

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;

  let result = '';
  if (millions > 0) {
      result += convertThreeDigits(millions, 'm') + (millions === 1 ? ' milhão' : ' milhões');
      if (thousands > 0 || rest > 0) result += ' e ';
  }

  if (thousands > 0) {
    if (thousands === 1) {
      result += 'mil';
    } else {
      result += convertThreeDigits(thousands, 'm') + ' mil';
    }
    if (rest > 0) result += ' e ';
  }

  if (rest > 0 || (millions === 0 && thousands === 0)) {
    result += convertThreeDigits(rest, gender);
  }

  return result.trim();
};

export const formatWeightPtBr = (num: number): string => {
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 1000);

  let result = '';
  
  if (integerPart > 0) {
    result += numberToWordsPtBr(integerPart, 'f') + (integerPart === 1 ? ' tonelada' : ' toneladas');
  }

  if (decimalPart > 0) {
    if (result) result += ' e ';
    result += numberToWordsPtBr(decimalPart, 'm') + (decimalPart === 1 ? ' quilo' : ' quilos');
  }

  return (result || 'zero toneladas').toUpperCase();
};

export const getShipmentStatusLabel = (status: string): string => {
  switch (status) {
    case 'Pré-cadastro':
      return 'Triagem / Pré-Cadastro';
    case 'Ag. Seguradora':
      return 'Análise de Risco (PGR)';
    case 'Ag. Carregamento':
      return 'Aguardando Check-in / Carga';
    case 'Ag. Nota':
      return 'Emissão Fiscal (CT-e / NF-e)';
    case 'Ag. Adiantamento':
      return 'Liberação de Adiantamento';
    case 'Ag. Agendamento':
      return 'Agendamento de Descarga (Slot)';
    case 'Ag. Descarga':
      return 'Em Trânsito / Aguardando Descarga';
    case 'Ag. Saldo':
      return 'Liquidação de Saldo';
    case 'Finalizado':
      return 'Operação Concluída';
    case 'Cancelado':
      return 'Cancelado';
    default:
      return status;
  }
};
