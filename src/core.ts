import { ProxyAgent, fetch as undiciFetch } from 'undici';
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

export function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || null;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cityKey(city: string): string {
  return city.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

export function getCityLocation(city: string): { lat: number; lng: number; label: string } {
  const key = cityKey(city);
  const location = CITY_COORDS[key];
  if (!location) {
    const supportedCities = Object.values(CITY_COORDS)
      .map((entry) => entry.label)
      .filter((label, index, labels) => labels.indexOf(label) === index)
      .join(', ');
    throw new Error(`Unsupported Swiggy city "${city}". Use one of: ${supportedCities}.`);
  }
  return location;
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

export function collectRestaurants(node: unknown, output: SwiggyRestaurantInfo[], seen: Set<string>): void {
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

export function matchesCuisine(info: SwiggyRestaurantInfo, cuisines: string[]): boolean {
  if (!cuisines.length) return true;
  const haystack = [info.name, ...(info.cuisines ?? [])].join(' ').toLowerCase();
  return cuisines.some((cuisine) => haystack.includes(cuisine.toLowerCase()));
}

export function matchesLocality(info: SwiggyRestaurantInfo, locality: string | null): boolean {
  const target = normalizeText(locality);
  if (!target) return true;
  const normalizedTarget = cityKey(target);
  const haystack = [info.locality, info.areaName, info.slug, info.name]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .map((value) => cityKey(value as string))
    .join(' ');
  return haystack.includes(normalizedTarget);
}

export function buildListUrl(city: string, offset: string | null, sortBy: string | undefined): string {
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

export async function fetchSwiggyJson(
  url: string,
  proxyConfiguration?: { newUrl: () => string | undefined | Promise<string | undefined> },
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const proxyUrl = proxyConfiguration ? await proxyConfiguration.newUrl() : undefined;
    const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

    try {
      const response = await undiciFetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          accept: 'application/json',
          referer: 'https://www.swiggy.com/',
          'accept-language': 'en-IN,en;q=0.9',
        },
        dispatcher,
        signal: AbortSignal.timeout(20_000),
      });

      if (response.ok) {
        const json = await response.json() as Record<string, unknown>;
        if (!json?.data || typeof json.data !== 'object') throw new Error('Swiggy returned no recognizable listing data.');
        return json;
      }
      await response.body?.cancel();
      lastError = new Error(`Swiggy API returned ${response.status} for ${url}`);
    } catch (error) {
      lastError = error as Error;
    } finally {
      await dispatcher?.destroy();
    }

    if (attempt < 2) await delay(500);
  }

  throw lastError ?? new Error(`Swiggy API request failed for ${url}`);
}

export function toRecord(info: SwiggyRestaurantInfo, input: Required<Pick<ActorInput, 'cuisines'>>, city: string, locality: string | null, position: number): RestaurantRecord {
  const sla = info.sla ?? {};
  const availability = info.availability ?? {};
  const coords = getCityLocation(city);

  return {
    source: 'swiggy',
    imageUrl: imageUrl(info.cloudinaryImageId),
    searchCity: coords.label,
    searchCoordinates: { latitude: coords.lat, longitude: coords.lng },
    locationMethod: 'city_center',
    localityFilterMode: 'text_match_not_delivery_location',
    currency: 'INR',
    deliveryTimeText: normalizeText(sla.slaString),
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
    pureVeg: info.veg ?? info.isPureVeg ?? null,
    openClosedStatus: info.isOpen ?? availability.opened ?? null,
    restaurantUrl: restaurantUrl(info),
    locality: normalizeText(info.locality ?? info.areaName),
    city: coords.label,
    promotedSponsored: String(info.adTrackingId ?? '').length > 0,
    scrapedAt: new Date().toISOString(),
  };
}


