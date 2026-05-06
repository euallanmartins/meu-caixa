type ServiceLike = {
  nome: string;
  categoria?: string | null;
  mais_vendido?: boolean | null;
  destaque?: boolean | null;
  ordem?: number | null;
};

export type ServiceDisplay = {
  nome: string;
  profissional: string | null;
  categoria: string;
  popular: boolean;
  ordem: number;
  searchable: string;
};

const SMALL_WORDS = new Set(['a', 'as', 'e', 'o', 'os', 'da', 'de', 'do', 'das', 'dos', 'com', 'em', 'na', 'no']);

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function titleCase(value: string) {
  const normalized = value
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
    .toLowerCase();

  return normalized
    .split(' ')
    .map((word, index) => {
      if (!word) return word;
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function canonicalCategory(value: string) {
  const label = titleCase(value);
  const normalized = normalize(label);

  if (normalized === 'diego' || normalized === 'diego souza') return 'Diego Souza';

  return label;
}

function cleanServiceName(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^\s*\d+\s*[-.)]\s*/g, '')
    .trim();
}

function detectProfessional(value: string) {
  const match = value.match(/\s+com\s+([A-ZÀ-Ú][A-ZÀ-Ú\s'.-]{2,})$/);
  const candidate = match?.[1]?.trim() || '';
  const words = candidate.split(/\s+/).filter(Boolean);
  const isKnownSingleName = normalize(candidate) === 'diego';
  const isProfessionalSuffix = Boolean(match && (words.length >= 2 || isKnownSingleName) && candidate === candidate.toUpperCase());

  return {
    professional: isProfessionalSuffix ? canonicalCategory(candidate) : null,
    serviceName: isProfessionalSuffix ? value.slice(0, match?.index).trim() : value,
  };
}

export function detectServiceCategory(service: ServiceLike, displayName?: string) {
  if (service.categoria?.trim()) return canonicalCategory(service.categoria);

  const name = normalize(displayName || service.nome);

  if (name.includes('+') || name.includes(',') || name.includes('combo')) return 'Combo';
  if (name.includes('sobrancelha')) return 'Sobrancelha';
  if (name.includes('barba')) return 'Barba';
  if (name.includes('corte') || name.includes('cabelo')) return 'Corte';
  if (
    name.includes('alinhamento') ||
    name.includes('luzes') ||
    name.includes('progressiva') ||
    name.includes('pigmentacao') ||
    name.includes('pigmentação')
  ) {
    return 'Quimica';
  }
  if (name.includes('premium')) return 'Premium';
  if (name.includes('infantil') || name.includes('crianca') || name.includes('criança')) return 'Infantil';

  return 'Outros';
}

export function getServiceDisplay(service: ServiceLike): ServiceDisplay {
  const cleanName = cleanServiceName(service.nome);
  const { professional, serviceName } = detectProfessional(cleanName);
  const nome = titleCase(serviceName || cleanName);
  const categoria = professional || detectServiceCategory(service, nome);

  return {
    nome,
    profissional: professional,
    categoria,
    popular: Boolean(service.mais_vendido || service.destaque),
    ordem: Number(service.ordem || 0),
    searchable: normalize(`${nome} ${professional || ''} ${categoria}`),
  };
}

export function searchText(value: string) {
  return normalize(value);
}
