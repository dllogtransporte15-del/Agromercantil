// ============================================================================
// MOTOR DE VOZ MASCULINA NATURAL & PROSÓDIA HUMANA PARA AULAS NARRADAS (PT-BR)
// ============================================================================

const FEMALE_VOICE_KEYWORDS = [
  'maria',
  'francisca',
  'thalita',
  'leila',
  'leticia',
  'letícia',
  'camila',
  'vitoria',
  'vitória',
  'fernanda',
  'luciana',
  'joana',
  'raquel',
  'heloisa',
  'heloísa',
  'brenda',
  'elza',
  'giovanna',
  'manuela',
  'yara',
  'ines',
  'inês',
  'female',
  'feminino',
  'feminina',
  'mulher'
];

const NEURAL_MALE_KEYWORDS = [
  'antonio',
  'antônio',
  'donato',
  'fabio',
  'fábio',
  'humberto',
  'julio',
  'júlio',
  'nicolau',
  'valerio',
  'valério',
  'duarte'
];

const STANDARD_MALE_KEYWORDS = [
  'daniel',
  'felipe',
  'luciano',
  'ricardo',
  'cristiano',
  'miguel',
  'carlos',
  'luca',
  'jorge',
  'male',
  'masculino',
  'masculina',
  'homem'
];

export function isLikelyFemaleVoice(voice: SpeechSynthesisVoice): boolean {
  const n = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  return FEMALE_VOICE_KEYWORDS.some(k => n.includes(k));
}

export function isLikelyMaleVoice(voice: SpeechSynthesisVoice): boolean {
  const n = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  if (isLikelyFemaleVoice(voice)) return false;
  return (
    NEURAL_MALE_KEYWORDS.some(k => n.includes(k)) ||
    STANDARD_MALE_KEYWORDS.some(k => n.includes(k))
  );
}

export function isNeuralOrNaturalVoice(voice: SpeechSynthesisVoice): boolean {
  const n = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  return n.includes('natural') || n.includes('neural') || n.includes('online');
}

/**
 * Pontua vozes em português priorizando:
 * 1. Vozes Masculinas Neurais / Naturais PT-BR (ex: Microsoft Antonio Online (Natural), Donato, Fabio)
 * 2. Vozes Masculinas Neurais PT-PT (ex: Duarte)
 * 3. Vozes Masculinas Nativas PT-BR (ex: Microsoft Daniel, Felipe, Ricardo)
 * 4. Vozes Neutras PT-BR (com ajuste de tom grave masculino)
 * 5. Vozes Femininas ficam por último apenas como fallback extremo
 */
export function scorePortugueseMaleVoice(voice: SpeechSynthesisVoice): number {
  const n = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  const lang = voice.lang.toLowerCase();

  if (!lang.includes('pt')) return -1000;

  let score = 0;

  // Preferência forte por Português do Brasil (pt-BR)
  if (lang.includes('pt-br') || lang.includes('pt_br')) {
    score += 300;
  } else {
    score += 100;
  }

  const isNeural = isNeuralOrNaturalVoice(voice);
  const isMale = isLikelyMaleVoice(voice);
  const isFemale = isLikelyFemaleVoice(voice);

  if (isMale && isNeural) {
    score += 1000;
    if (n.includes('antonio') || n.includes('antônio')) score += 150;
    else if (n.includes('donato')) score += 140;
    else if (n.includes('fabio') || n.includes('fábio')) score += 130;
    else if (n.includes('humberto')) score += 120;
    else if (n.includes('julio') || n.includes('júlio')) score += 110;
    else if (n.includes('nicolau')) score += 100;
    else if (n.includes('valerio') || n.includes('valério')) score += 90;
  } else if (isMale) {
    score += 700;
    if (n.includes('daniel')) score += 80;
    if (n.includes('felipe') || n.includes('ricardo') || n.includes('luciano')) score += 70;
  } else if (!isFemale) {
    // Voz sem gênero explícito no nome (ex: Google português do Brasil)
    score += isNeural ? 350 : 250;
  } else {
    // Voz explicitamente feminina (penalizada para nunca ganhar de uma masculina)
    score -= 500;
    if (isNeural) score += 100;
  }

  return score;
}

/**
 * Retorna a lista de vozes em Português ordenadas com as melhores vozes masculinas no topo
 */
export function getSortedPortugueseVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const allVoices = window.speechSynthesis.getVoices();
  const ptVoices = allVoices.filter(v => v.lang.toLowerCase().includes('pt'));
  const pool = ptVoices.length > 0 ? ptVoices : allVoices;

  return [...pool].sort((a, b) => scorePortugueseMaleVoice(b) - scorePortugueseMaleVoice(a));
}

/**
 * Seleciona automaticamente a melhor voz masculina e mais natural disponível
 */
export function pickBestMaleVoice(voices?: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const list = voices && voices.length > 0 ? [...voices].sort((a, b) => scorePortugueseMaleVoice(b) - scorePortugueseMaleVoice(a)) : getSortedPortugueseVoices();
  return list[0];
}

/**
 * Formata o rótulo da voz no seletor para destacar vozes Masculinas e Naturais
 */
export function formatVoiceOptionLabel(voice: SpeechSynthesisVoice): string {
  const isMale = isLikelyMaleVoice(voice);
  const isFemale = isLikelyFemaleVoice(voice);
  const isNeural = isNeuralOrNaturalVoice(voice);

  const cleanName = voice.name
    .replace(/Microsoft\s+/i, '')
    .replace(/\s*Online\s*\(Natural\)\s*/i, '')
    .replace(/\s*Desktop\s*/i, '')
    .replace(/\s*-\s*Portuguese\s*\(Brazil\)/i, '')
    .replace(/\s*-\s*Portuguese\s*\(Portugal\)/i, '')
    .trim();

  if (isMale && isNeural) {
    return `🎙️ ${cleanName} (Masculina Natural HD)`;
  }
  if (isMale) {
    return `🎙️ ${cleanName} (Masculina)`;
  }
  if (!isFemale) {
    return `🔊 ${cleanName} (Tom Masculino Ajustado)`;
  }
  return `🔈 ${cleanName} (Feminina)`;
}

/**
 * Calcula pitch e rate ideais para deixar a voz masculina, encorpada e menos robótica
 */
export function getNaturalVoiceParams(
  voice: SpeechSynthesisVoice | undefined,
  userSpeed: number = 1.0
): { pitch: number; rate: number } {
  if (!voice) {
    return { pitch: 0.88, rate: Number((userSpeed * 0.98).toFixed(2)) };
  }

  const isMale = isLikelyMaleVoice(voice);
  const isFemale = isLikelyFemaleVoice(voice);
  const isNeural = isNeuralOrNaturalVoice(voice);

  // Vozes Masculinas Neurais (ex: Antonio, Donato, Fabio) já possuem timbre humano perfeito
  if (isMale && isNeural) {
    return {
      pitch: 0.97,
      rate: Number((userSpeed * 1.01).toFixed(2))
    };
  }

  // Vozes Masculinas Offline (ex: Microsoft Daniel) ficam muito mais naturais com tom levemente mais grave e cadência fluida
  if (isMale && !isNeural) {
    return {
      pitch: 0.92,
      rate: Number((userSpeed * 1.04).toFixed(2))
    };
  }

  // Voz genérica ou feminina usada como fallback: aplica pitch mais grave para soar masculina e menos metálica
  if (!isFemale) {
    return {
      pitch: 0.82,
      rate: Number((userSpeed * 0.99).toFixed(2))
    };
  }

  return {
    pitch: 0.85,
    rate: Number((userSpeed * 0.99).toFixed(2))
  };
}

/**
 * Converte siglas fiscais, símbolos matemáticos, valores em R$ e abreviações logísticas
 * em texto falado fluido para que o sintetizador fale como um professor humano.
 */
export function humanizeCourseSpeechText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Símbolos gráficos e matemáticos comuns no curso
  text = text
    .replace(/⇄/g, ', em conexão direta com ')
    .replace(/→/g, ', portanto, ')
    .replace(/≈/g, 'aproximadamente ')
    .replace(/÷/g, ' dividido por ')
    .replace(/×/g, ' vezes ')
    .replace(/•/g, '. ')
    .replace(/—|–/g, ', ');

  // 2. Valores monetários: R$ 200,00/tonelada, R$ 180,00/t, R$ 20,00
  text = text.replace(/R\$\s*(\d+(?:\.\d{3})*),00\s*\/\s*(?:tonelada|t\b)/gi, '$1 reais por tonelada');
  text = text.replace(/R\$\s*(\d+(?:\.\d{3})*,\d{2})\s*\/\s*(?:tonelada|t\b)/gi, '$1 reais por tonelada');
  text = text.replace(/R\$\s*(\d+(?:\.\d{3})*),00\b/g, '$1 reais');
  text = text.replace(/R\$\s*(\d+(?:\.\d{3})*,\d{2})\b/g, '$1 reais');
  text = text.replace(/R\$\s*(\d+(?:\.\d{3})*)\b/g, '$1 reais');

  // 3. Medidas de peso e capacidade (ex: 220t, 48,5 t, t/viagem)
  text = text.replace(/(\d+(?:,\d+)?)\s*t\s*\/\s*viagem/gi, '$1 toneladas por viagem');
  text = text.replace(/(\d+(?:,\d+)?)\s*t\b/g, '$1 toneladas');
  text = text.replace(/\/tonelada\b/gi, ' por tonelada');
  text = text.replace(/\/t\b/g, ' por tonelada');

  // 4. Leis e Emendas Constitucionais
  text = text.replace(/\bEC\s*132\/2023\b/g, 'Emenda Constitucional 132 de 2023');
  text = text.replace(/\bLC\s*214\/2025\b/g, 'Lei Complementar 214 de 2025');
  text = text.replace(/\bLei\s*11\.442\/2007\b/gi, 'Lei onze mil quatrocentos e quarenta e dois de 2007');
  text = text.replace(/\bLei\s*11\.442\b/gi, 'Lei onze mil quatrocentos e quarenta e dois');

  // 5. Siglas fiscais e logísticas (evita leitura robótica de hífens e barras)
  text = text
    .replace(/\bCT-e\s*\/\s*NF-e\b/gi, 'C T é e Nota Fiscal Eletrônica')
    .replace(/\bCT-e\b/gi, 'C T é')
    .replace(/\bMDF-e\b/gi, 'M D F é')
    .replace(/\bNF-e\b/gi, 'Nota Fiscal Eletrônica')
    .replace(/\bDACTE\b/gi, 'Dacte')
    .replace(/\bDANFE\b/gi, 'Danfe')
    .replace(/\bDAMDFE\b/gi, 'Damdfe')
    .replace(/\bPIS\s*\/\s*COFINS\b/gi, 'PIS e Cofins')
    .replace(/\bCOFINS\b/gi, 'Cofins')
    .replace(/\bCBS\s*\/\s*IBS\b/gi, 'C B S e I B S')
    .replace(/\bIBS\s*\/\s*CBS\b/gi, 'I B S e C B S')
    .replace(/\bPF\s*\/\s*PJ\b/gi, 'Pessoa Física ou Jurídica')
    .replace(/\bICMS\b/g, 'I C M S')
    .replace(/\bANTT\b/g, 'A N T T')
    .replace(/\bRNTRC\b/g, 'R N T R C')
    .replace(/\bCIOT\b/g, 'Ciot')
    .replace(/\bPGR\b/g, 'P G R')
    .replace(/\bPBT\b/g, 'P B T')
    .replace(/\bPBTC\b/g, 'P B T C')
    .replace(/\bTAC\b/g, 'T A C')
    .replace(/\bETC\b/g, 'E T C')
    .replace(/\bDLLOG\b/gi, 'D L Log');

  // 6. Limpeza de barras restantes entre palavras (ex: "Frete / Margem" -> "Frete e Margem")
  text = text.replace(/([A-Za-zÀ-ÿ]+)\s*\/\s*([A-Za-zÀ-ÿ]+)/g, '$1 ou $2');

  // 7. Espaços múltiplos
  text = text.replace(/\s{2,}/g, ' ').trim();

  return text;
}

/**
 * Divide um parágrafo longo em frases naturais para que o narrador faça pausas
 * respiratórias orgânicas entre as frases e nunca perca a entonação.
 */
export function splitIntoNaturalSpeechSegments(paragraph: string): string[] {
  const humanized = humanizeCourseSpeechText(paragraph);
  if (!humanized) return [];

  // Divide após ponto final, exclamação, interrogação ou dois-pontos seguidos de espaço
  const rawParts = humanized
    .split(/(?<=[.!?])\s+|(?<=:)\s+(?=[A-ZÀ-Ý])/g)
    .map(s => s.trim())
    .filter(Boolean);

  return rawParts.length > 0 ? rawParts : [humanized];
}
