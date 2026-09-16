export const cityDddMap: Record<string, string[]> = {
  'catalão': ['64'],
  'rio verde': ['64'],
  'goiânia': ['62'],
  'anápolis': ['62'],
  'cristalina': ['61'],
  
  'cuiabá': ['65'],
  'sinop': ['66'],
  'sorriso': ['66'],
  'rondonópolis': ['66'],
  'lucas do rio verde': ['66'],
  'nova mutum': ['66'],
  'primavera do leste': ['66'],
  
  'campo grande': ['67'],
  'dourados': ['67'],
  'rio verde de mato grosso': ['67'],
  
  'são paulo': ['11'],
  'santos': ['13'],
  'guarujá': ['13'],
  
  'paranaguá': ['41'],
  
  'uberlândia': ['34'],
  'patrocínio': ['34'],
  'passos': ['35'],
  'guarda-mor': ['38'],
  
  'luís eduardo magalhães': ['77'],
  'barreiras': ['77'],
};

export const stateDddMap: Record<string, string[]> = {
  'go': ['61', '62', '64'],
  'mt': ['65', '66'],
  'ms': ['67'],
  'sp': ['11', '12', '13', '14', '15', '16', '17', '18', '19'],
  'pr': ['41', '42', '43', '44', '45', '46'],
  'mg': ['31', '32', '33', '34', '35', '37', '38'],
  'ba': ['71', '73', '74', '75', '77'],
};

export function getDDDsFromCity(cityString: string): string[] {
  if (!cityString) return [];
  const normalized = cityString.toLowerCase();
  
  // 1. Exact city match in string
  for (const [city, ddds] of Object.entries(cityDddMap)) {
    if (normalized.includes(city)) {
      return ddds;
    }
  }

  // 2. State abbreviation match
  const parts = normalized.split(/[\s,-/]+/); // split by space, comma, dash, slash
  for (const part of parts) {
    if (stateDddMap[part]) {
      return stateDddMap[part];
    }
  }

  return [];
}
