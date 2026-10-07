import { Actor, log } from 'apify';
import { wasPushedRecordSaved } from './billing.js';
import { normalizeInput } from './input.js';
import type { ActorInput, SwiggyRestaurantInfo } from './types.js';
import { delay, getCityLocation, collectRestaurants, matchesCuisine, matchesLocality, buildListUrl, fetchSwiggyJson, toRecord, normalizeText } from './core.js';

await Actor.main(async () => {
  const input = normalizeInput(await Actor.getInput<ActorInput>());
  // Validate all destinations before opening a proxy or making a source request.
  const cities = input.cities.filter((city, index, values) => {
    const location = getCityLocation(city);
    return values.findIndex((other) => {
      const candidate = getCityLocation(other);
      return candidate.lat === location.lat && candidate.lng === location.lng;
    }) === index;
  });
  const proxyConfiguration = input.proxyConfiguration.useApifyProxy
    ? await Actor.createProxyConfiguration(input.proxyConfiguration)
    : undefined;
  const seen = new Set<string>();
  let savedCount = 0;
  let spendingLimitReached = false;
  let fatalBillingError: Error | null = null;
  let pagesFetched = 0;
  const stopReasons: string[] = [];
  const deadline = Date.now() + 210_000;

  log.info('Starting Swiggy API scrape', {
    cities: input.cities,
    cuisines: input.cuisines,
    maxResults: input.maxResults,
  });

  for (const city of cities) {
    if (savedCount >= input.maxResults || spendingLimitReached || fatalBillingError) break;
    {
      if (savedCount >= input.maxResults || spendingLimitReached || fatalBillingError) break;
      let offset: string | null = null;
      const visitedOffsets = new Set<string>();
      const candidateIds = new Set<string>();

      for (let page = 0; page < 8 && savedCount < input.maxResults && !spendingLimitReached && !fatalBillingError; page += 1) {
        if (Date.now() >= deadline) { stopReasons.push('time_limit'); break; }
        const url = buildListUrl(city, offset, input.sortBy);
        log.info('Fetching Swiggy restaurant page', { city, page: page + 1 });
        const json = await fetchSwiggyJson(url, proxyConfiguration);
        pagesFetched++;

        const restaurants: SwiggyRestaurantInfo[] = [];
        collectRestaurants(json, restaurants, new Set<string>());
        const freshCandidates = restaurants.filter((info) => !candidateIds.has(String(info.id)));
        for (const info of restaurants) candidateIds.add(String(info.id));
        if (restaurants.length > 0 && freshCandidates.length === 0) { stopReasons.push('repeated_page'); break; }
        log.info('Extracted restaurant candidates', { city, page: page + 1, count: restaurants.length });

        for (const info of restaurants) {
          if (savedCount >= input.maxResults) break;
          if (!matchesCuisine(info, input.cuisines)) continue;
          const locality = input.localities.find((value) => matchesLocality(info, value)) ?? null;
          if (input.localities.length && locality === null) continue;
          const id = String(info.id);
          if (seen.has(id)) continue;

          const record = toRecord(info, input, city, locality, savedCount + 1);
          if (!record.restaurantName || !record.restaurantUrl) continue;

          try {
            const chargeResult = await Actor.pushData(record, 'restaurant-scraped');
            const recordWasSaved = wasPushedRecordSaved(chargeResult);

            if (recordWasSaved) {
              seen.add(id);
              savedCount += 1;
            }

            if (chargeResult.eventChargeLimitReached) {
              spendingLimitReached = true;
              await Actor.setStatusMessage(`Stopped at the user's spending limit after ${savedCount} restaurants`);
              log.info('User spending limit reached; stopping before more Swiggy pages are requested.');
              break;
            }
          } catch (error) {
            fatalBillingError = error instanceof Error ? error : new Error(String(error));
            spendingLimitReached = true;
            await Actor.setStatusMessage('Stopped because restaurant output billing failed.');
            log.error('Stopping Swiggy run because dataset push with restaurant-scraped charge failed.', {
              error: fatalBillingError.message,
            });
            throw fatalBillingError;
          }
        }

        const data = json.data as { pageOffset?: { nextOffset?: string } } | undefined;
        const nextOffset = normalizeText(data?.pageOffset?.nextOffset);
        if (savedCount >= input.maxResults || spendingLimitReached) break;
        if (!nextOffset) { stopReasons.push('source_end'); break; }
        if (nextOffset === offset || visitedOffsets.has(nextOffset)) { stopReasons.push('repeated_offset'); break; }
        if (page === 7) { stopReasons.push('page_limit'); break; }
        visitedOffsets.add(nextOffset);
        offset = nextOffset;
        await delay(1000 + Math.floor(Math.random() * 1500));
      }
    }
  }

  if (fatalBillingError) throw fatalBillingError;
  await Actor.setValue('OUTPUT', {
    savedCount, pagesFetched, spendingLimitReached, stopReasons,
    coverage: 'City-center listings only; locality filters do not select a delivery address.',
    requestedLimitReached: savedCount >= input.maxResults,
  });
  if (savedCount === 0 && !spendingLimitReached) {
    throw new Error('Swiggy scrape finished with no saved restaurants.');
  }

  log.info('Swiggy scrape finished', { savedCount });
});
