import { Actor, log } from 'apify';
import type { ActorInput, RestaurantRecord, SwiggyRestaurantInfo } from './types.js';

const CITY_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  bangalore: { lat: 12.9715987, lng: 77.5945627, label: 'Bangalore' },
  bengaluru: { lat: 12.9715987, lng: 77.5945627, label: 'Bangalore' },
  mumbai: { lat: 19.076, lng: 72.8777, label: 'Mumbai' },
  delhi: { lat: 28.6139, lng: 77.209, label: 'Delhi' },
  'delhi ncr': { lat: 28.4595, lng: 77.0266, label: 'Delhi NCR' },
  gurgaon: { lat: 28.4595, lng: 77.0266, label: 'Gurgaon' },
  gurugram: { lat: 28.4595, lng: 77.0266, label: 'Gurgaon' },
  pune: { lat: 18.5204, lng: 73.8567, label: 'Pune' },
  hyderabad: { lat: 17.385, lng: 78.4867, label: 'Hyderabad' },
  chennai: { lat: 13.0827, lng: 80.2707, label: 'Chennai' },
  kolkata: { lat: 22.5726, lng: 88.3639, label: 'Kolkata' },
  ahmedabad: { lat: 23.0225, lng: 72.5714, label: 'Ahmedabad' },
  jaipur: { lat: 26.9124, lng: 75.7873, label: 'Jaipur' },
  lucknow: { lat: 26.8467, lng: 80.9462, label: 'Lucknow' },
  chandigarh: { lat: 30.7333, lng: 76.7794, label: 'Chandigarh' },
  kochi: { lat: 9.9312, lng: 76.2673, label: 'Kochi' },
};

const SORT_MAP: Record<string, string> = {
  RELEVANCE: 'RELEVANCE',
  RATING: 'RATING',
  DELIVERY_TIME: 'DELIVERY_TIME',
  COST_LOW_TO_HIGH: 'COST_FOR_TWO',
  COST_HIGH_TO_LOW: 'COST_FOR_TWO_H2L',
};

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || null;
}

function cityKey(city: string): string {
  return city.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

function getCityLocation(city: string): { lat: number; lng: number; label: string } {
  const key = cityKey(city);
  return CITY_COORDS[key] ?? { lat: 12.9715987, lng: 77.5945627, label: city.trim() || 'Bangalore' };
}

function parseCount(value: unknown): number | null {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k|m)?/i);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'm') return Math.round(base * 1_000_000);
  if (suffix === 'k') return Math.round(base * 1_000);
  return Math.round(base);
}

function parsePrice(value: unknown): number | null {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function imageUrl(cloudinaryImageId: unknown): string | null {
  const id = normalizeText(cloudinaryImageId);
  if (!id) return null;
  if (id.startsWith('http')) return id;
  return `https://media-assets.swiggy.com/swiggy/image/upload/${id}`;
}

function restaurantUrl(info: SwiggyRestaurantInfo): string {
  const slug = normalizeText(info.slug) ?? normalizeText(info.name)?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ?? 'restaurant';
  return `https://www.swiggy.com/restaurants/${slug}-${info.id}`;
}

function collectRestaurants(node: unknown, output: SwiggyRestaurantInfo[], seen: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const info = obj.info as SwiggyRestaurantInfo | undefined;
  if (info?.id && info.name && !seen.has(String(info.id))) {
    seen.add(String(info.id));
    output.push(info);
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const child of value) collectRestaurants(child, output, seen);
    } else if (value && typeof value === 'object') {
      collectRestaurants(value, output, seen);
    }
  }
}

function extractOffers(info: SwiggyRestaurantInfo): string[] {
  const offers = new Set<string>();
  const discount = info.aggregatedDiscountInfoV3;
  const discountText = [discount?.header, discount?.subHeader, discount?.discountTag].map(normalizeText).filter(Boolean).join(' ');
  if (discountText) offers.add(discountText);

  const nestedOffers = info.aggregatedDiscountInfoV2?.descriptionList;
  if (Array.isArray(nestedOffers)) {
    for (const item of nestedOffers) {
      const text = normalizeText(item?.meta ?? item?.description);
      if (text) offers.add(text);
    }
  }

  return [...offers];
}

function matchesCuisine(info: SwiggyRestaurantInfo, cuisines: string[]): boolean {
  if (!cuisines.length) return true;
  const haystack = [info.name, ...(info.cuisines ?? [])].join(' ').toLowerCase();
  return cuisines.some((cuisine) => haystack.includes(cuisine.toLowerCase()));
}

function buildListUrl(city: string, offset: string | null, sortBy: string | undefined): string {
  const location = getCityLocation(city);
  const url = new URL('https://www.swiggy.com/dapi/restaurants/list/v5');
  url.searchParams.set('lat', String(location.lat));
  url.searchParams.set('lng', String(location.lng));
  url.searchParams.set('is-seo-homepage-enabled', 'true');
  url.searchParams.set('page_type', 'DESKTOP_WEB_LISTING');
  if (offset) url.searchParams.set('offset', offset);
  const sort = SORT_MAP[sortBy ?? 'RELEVANCE'];
  if (sort && sort !== 'RELEVANCE') url.searchParams.set('sortBy', sort);
  return url.toString();
}

async function fetchSwiggyJson(url: string, proxyUrl?: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      accept: 'application/json',
      referer: 'https://www.swiggy.com/',
      'accept-language': 'en-IN,en;q=0.9',
    },
    // Native fetch ignores proxyUrl; Apify proxy is handled by browser actors more easily.
    // The public API usually works directly, so proxy fallback is intentionally not forced here.
  });

  if (!response.ok) {
    throw new Error(`Swiggy API returned ${response.status} for ${url}${proxyUrl ? ' using proxy' : ''}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

function toRecord(info: SwiggyRestaurantInfo, input: Required<Pick<ActorInput, 'cuisines'>>, city: string, locality: string | null, position: number): RestaurantRecord {
  const sla = info.sla ?? {};
  const availability = info.availability ?? {};
  const coords = getCityLocation(city);

  return {
    source: 'swiggy',
    imageUrl: imageUrl(info.cloudinaryImageId),
    searchCity: coords.label,
    searchLocality: locality,
    searchCuisine: input.cuisines.length ? input.cuisines.join(', ') : null,
    position,
    restaurantId: String(info.id),
    restaurantName: normalizeText(info.name) ?? '',
    cuisineTypes: Array.isArray(info.cuisines) ? info.cuisines.map(String).filter(Boolean) : [],
    costForTwo: normalizeText(info.costForTwo),
    priceForTwo: parsePrice(info.costForTwo),
    overallRating: Number(info.avgRating ?? info.avgRatingString) || null,
    totalRatingsCount: parseCount(info.totalRatingsString ?? info.totalRatings),
    deliveryTimeEstimate: Number(sla.deliveryTime) || null,
    distance: normalizeText(sla.lastMileTravelString) ?? (sla.lastMileTravel ? `${sla.lastMileTravel} km` : null),
    offersAndDiscounts: extractOffers(info),
    pureVeg: Boolean(info.veg ?? info.isPureVeg),
    openClosedStatus: Boolean(info.isOpen ?? availability.opened),
    restaurantUrl: restaurantUrl(info),
    locality: normalizeText(info.locality ?? info.areaName),
    city: coords.label,
    promotedSponsored: String(info.adTrackingId ?? '').length > 0,
    scrapedAt: new Date().toISOString(),
  };
}

function normalizeInput(input: ActorInput | null): Required<ActorInput> {
  const cities = input?.cities?.length ? input.cities.map((city) => city.trim()).filter(Boolean) : ['Bangalore'];
  return {
    cities: cities.length ? cities : ['Bangalore'],
    localities: input?.localities ?? [],
    cuisines: input?.cuisines ?? [],
    sortBy: input?.sortBy ?? 'RELEVANCE',
    scrapeMenuSummary: input?.scrapeMenuSummary ?? false,
    maxResults: Math.min(Math.max(input?.maxResults ?? 50, 1), 300),
    proxyConfiguration: input?.proxyConfiguration ?? { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], apifyProxyCountry: 'IN' },
  };
}

await Actor.init();

try {
  const input = normalizeInput(await Actor.getInput<ActorInput>());
  const seen = new Set<string>();
  let savedCount = 0;

  log.info('Starting Swiggy API scrape', {
    cities: input.cities,
    cuisines: input.cuisines,
    maxResults: input.maxResults,
  });

  for (const city of input.cities) {
    if (savedCount >= input.maxResults) break;
    const localities = input.localities.length ? input.localities : [null];

    for (const locality of localities) {
      if (savedCount >= input.maxResults) break;
      let offset: string | null = null;

      for (let page = 0; page < 8 && savedCount < input.maxResults; page += 1) {
        const url = buildListUrl(city, offset, input.sortBy);
        log.info('Fetching Swiggy restaurant page', { city, locality, page: page + 1 });
        const json = await fetchSwiggyJson(url);

        const restaurants: SwiggyRestaurantInfo[] = [];
        collectRestaurants(json, restaurants, new Set<string>());
        log.info('Extracted restaurant candidates', { city, page: page + 1, count: restaurants.length });

        for (const info of restaurants) {
          if (savedCount >= input.maxResults) break;
          if (!matchesCuisine(info, input.cuisines)) continue;
          const id = String(info.id);
          if (seen.has(id)) continue;
          seen.add(id);

          const record = toRecord(info, input, city, locality, savedCount + 1);
          if (!record.restaurantName || !record.restaurantUrl) continue;

          await Actor.pushData(record);
          await Actor.charge({ eventName: 'restaurant-scraped' });
          savedCount += 1;
        }

        const data = json.data as { pageOffset?: { nextOffset?: string } } | undefined;
        const nextOffset = normalizeText(data?.pageOffset?.nextOffset);
        if (!nextOffset || nextOffset === offset) break;
        offset = nextOffset;
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.floor(Math.random() * 1500)));
      }
    }
  }

  log.info('Swiggy scrape finished', { savedCount });
} catch (error) {
  log.exception(error as Error, 'Swiggy actor failed');
  throw error;
} finally {
  await Actor.exit();
}
