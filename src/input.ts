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
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

export function normalizeInput(input: ActorInput | null): NormalizedActorInput {
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
