import type { ActorInput } from './types.js';

export interface NormalizedActorInput {
  cities: string[];
  localities: string[];
  cuisines: string[];
  sortBy: NonNullable<ActorInput['sortBy']>;
  maxResults: number;
  proxyConfiguration: {
    useApifyProxy: boolean;
    apifyProxyGroups: string[];
    apifyProxyCountry: string;
  };
}

const DEFAULT_PROXY = {
  useApifyProxy: true,
  apifyProxyGroups: ['RESIDENTIAL'],
  apifyProxyCountry: 'IN',
};

function cleanList(values: string[] | undefined): string[] {
  if (values !== undefined && (!Array.isArray(values) || values.some((value) => typeof value !== 'string'))) {
    throw new Error('Search fields must be arrays of strings.');
  }
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export function normalizeInput(input: ActorInput | null): NormalizedActorInput {
  if (input?.maxResults !== undefined && (!Number.isInteger(input.maxResults) || input.maxResults < 1)) {
    throw new Error('maxResults must be a positive integer.');
  }
  if (input?.sortBy !== undefined && !['RELEVANCE', 'RATING', 'DELIVERY_TIME', 'COST_LOW_TO_HIGH', 'COST_HIGH_TO_LOW'].includes(input.sortBy)) {
    throw new Error('Unsupported sortBy.');
  }
  const cities = cleanList(input?.cities);
  const cuisines = input?.cuisines === undefined ? ['pizza'] : cleanList(input.cuisines);

  return {
    cities: cities.length ? cities : ['Bangalore'],
    localities: cleanList(input?.localities),
    cuisines,
    sortBy: input?.sortBy ?? 'RELEVANCE',
    maxResults: Math.min(Math.max(input?.maxResults ?? 1, 1), 300),
    proxyConfiguration: {
      ...DEFAULT_PROXY,
      ...input?.proxyConfiguration,
    },
  };
}
