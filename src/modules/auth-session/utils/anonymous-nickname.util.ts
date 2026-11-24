import { randomInt } from 'crypto';

const FEMININE_NOUNS = [
  'Estrella',
  'Mariposa',
  'Orquídea',
  'Luna',
  'Brisa',
  'Semilla',
  'Nube',
  'Montaña',
  'Flor',
  'Cascada',
  'Amapola',
  'Paloma',
  'Libélula',
  'Alondra',
  'Cometa',
  'Pradera',
] as const;

const FEMININE_ADJECTIVES = [
  'Alegre',
  'Valiente',
  'Sonriente',
  'Luminosa',
  'Serena',
  'Amable',
  'Cariñosa',
  'Creativa',
  'Soñadora',
  'Radiante',
  'Curiosa',
  'Sincera',
  'Tierna',
  'Optimista',
  'Solidaria',
  'Esperanzada',
] as const;

const MASCULINE_NOUNS = [
  'Colibrí',
  'Girasol',
  'Arcoíris',
  'Roble',
  'Bosque',
  'Delfín',
  'Tucán',
  'Cóndor',
  'Sendero',
  'Sol',
  'Faro',
  'Lago',
  'Bambú',
  'Pino',
  'Cielo',
  'Río',
] as const;

const MASCULINE_ADJECTIVES = [
  'Alegre',
  'Valiente',
  'Sonriente',
  'Luminoso',
  'Sereno',
  'Amable',
  'Cariñoso',
  'Creativo',
  'Soñador',
  'Radiante',
  'Curioso',
  'Sincero',
  'Tierno',
  'Optimista',
  'Solidario',
  'Esperanzado',
] as const;

const GENERIC_PLACEHOLDER_NICKNAMES = new Set([
  'invitado',
  'visitante',
  'anonimo',
  'anónimo',
  'guest',
]);

export function generateFriendlyAnonymousNickname(): string {
  const useFeminine = randomInt(2) === 0;
  if (useFeminine) {
    const noun = FEMININE_NOUNS[randomInt(FEMININE_NOUNS.length)]!;
    const adjective = FEMININE_ADJECTIVES[randomInt(FEMININE_ADJECTIVES.length)]!;
    return `${noun} ${adjective}`;
  }
  const noun = MASCULINE_NOUNS[randomInt(MASCULINE_NOUNS.length)]!;
  const adjective = MASCULINE_ADJECTIVES[randomInt(MASCULINE_ADJECTIVES.length)]!;
  return `${noun} ${adjective}`;
}

export function resolveAnonymousNickname(requested?: string): string {
  const trimmed = requested?.trim();
  if (!trimmed || GENERIC_PLACEHOLDER_NICKNAMES.has(trimmed.toLowerCase())) {
    return generateFriendlyAnonymousNickname();
  }
  return trimmed;
}
