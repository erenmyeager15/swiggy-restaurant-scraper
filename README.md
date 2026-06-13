# Swiggy Restaurant Scraper - Listings, Ratings & Delivery Data

Scrape public Swiggy restaurant listing data by city, locality, and cuisine. This Actor collects restaurant names, cuisine types, ratings, rating counts, cost for two, delivery time, distance, visible offers, vegetarian status, locality, image URLs, and Swiggy restaurant URLs.

It is designed for food delivery research, restaurant market analysis, competitor monitoring, pricing intelligence, and local restaurant discovery datasets. The scraper uses Playwright, Crawlee, residential proxy support, session rotation, retries, and random waits for stable public-page collection.

This Actor extracts public business listing facts only. It does not collect phone numbers, emails, customer data, private account data, or personal profiles.

## Use Cases

- Food delivery market research by city and cuisine.
- Restaurant competitor tracking across local Swiggy listings.
- Rating, delivery time, and visible offer analysis.
- Local restaurant discovery for BI dashboards and maps.
- Food-tech datasets for pricing, cuisine, and availability trends.

## Input

```json
{
  "cities": ["Bangalore"],
  "localities": [],
  "cuisines": ["Chinese"],
  "sortBy": "RELEVANCE",
  "scrapeMenuSummary": false,
  "maxResults": 10,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"],
    "apifyProxyCountry": "IN"
  }
}
```

## Output

```json
{
  "source": "swiggy",
  "imageUrl": "https://media-assets.swiggy.com/swiggy/image/upload/...",
  "searchCity": "Bangalore",
  "searchLocality": null,
  "searchCuisine": "Chinese",
  "position": 1,
  "restaurantId": "123456",
  "restaurantName": "Example Kitchen",
  "cuisineTypes": ["Chinese", "Asian"],
  "costForTwo": "₹500 for two",
  "priceForTwo": 500,
  "overallRating": 4.2,
  "totalRatingsCount": 1200,
  "deliveryTimeEstimate": 32,
  "distance": "2.1 km",
  "offersAndDiscounts": ["20% off"],
  "pureVeg": false,
  "openClosedStatus": true,
  "locality": "Indiranagar",
  "city": "Bangalore",
  "promotedSponsored": false,
  "restaurantUrl": "https://www.swiggy.com/restaurants/example-kitchen-123456",
  "scrapedAt": "2026-06-13T12:00:00.000Z"
}
```

## How to Scrape Swiggy Restaurants

1. Enter one or more Indian cities, for example `Bangalore`, `Mumbai`, `Delhi`, `Pune`, or `Hyderabad`.
2. Optionally add localities or cuisine filters.
3. Set `maxResults` to control how many unique restaurants are saved.
4. Run the Actor.
5. Export results as JSON, CSV, Excel, or via API.

## Pricing

| Event | Price | When charged |
| --- | ---: | --- |
| `restaurant-scraped` | `$0.003` | Once per clean restaurant record saved to the dataset |

The Actor charges only after a restaurant record is successfully saved.

## Notes

- Swiggy pages can vary by city, locality, and region.
- Some fields may be `null` when Swiggy does not show them on the listing page.
- India residential proxies are recommended for reliable regional access.
- Optional menu summary scraping increases runtime and may not be available for every restaurant.

## Responsible Use

Use this Actor only for lawful purposes and in compliance with Swiggy's terms, robots.txt, applicable privacy laws, and local regulations. Do not use it to collect, store, or resell personal data without a lawful basis. This Actor is intended for public restaurant listing research and market analytics.

## License

Apache-2.0
