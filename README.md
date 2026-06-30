# Swiggy Restaurant Scraper - Listings, Ratings & Delivery Data

Scrape public Swiggy restaurant listing data by city, locality, and cuisine. This Actor collects restaurant names, cuisine types, ratings, rating counts, cost for two, delivery time, distance, visible offers, vegetarian status, locality, image URLs, and Swiggy restaurant URLs.

For the first run, start with one city, one cuisine such as `pizza`, `maxResults` set to `1`, and the recommended India residential proxy enabled. Inspect that record, then increase the limit.

It is designed for food delivery research, restaurant market analysis, competitor monitoring, pricing intelligence, and local restaurant discovery datasets. The scraper uses Swiggy's public web JSON responses with optional Apify Proxy routing, retries, and random waits for stable public listing collection.

This independent Actor extracts public business listing facts only. It is not an official Swiggy API and does not collect accounts, orders, customer data, private partner-dashboard data, hidden contacts, or personal profiles.

## Use Cases

- Food delivery market research by city and cuisine.
- Restaurant competitor tracking across local Swiggy listings.
- Rating, delivery time, and visible offer analysis.
- Local restaurant discovery for BI dashboards and maps.
- Food-tech datasets for pricing, cuisine, and availability trends.

## Pricing and cost control

This Actor uses Apify Pay Per Event pricing. Check the run cost estimate and set a maximum cost per run in Apify Console before scaling. Compute and India residential proxy use affect platform resource consumption.

| Event | Price | When charged |
| --- | ---: | --- |
| `apify-actor-start` | `$0.00005` | Charged at startup according to the live Apify pricing configuration |
| `restaurant-scraped` | `$0.003` | Once per clean restaurant record saved to the dataset |

Restaurant records are charged only when they are successfully saved. A small start event covers request initialization.

Cost-control tips:

- Start with one city, such as `Bangalore`.
- Use one cuisine filter, such as `pizza`, `biryani`, or `Chinese`.
- Use `maxResults: 1` for the first run.
- Leave localities empty unless you need a specific area.
- Keep the recommended India residential proxy enabled for regional reliability.
- Set a maximum cost per run in Apify Console. The Actor stops requesting more pages when Apify reports that limit.
- Increase result limits only after a small run returns the expected restaurant records.

## Input

Tiny test input:

```json
{
  "cities": ["Bangalore"],
  "localities": [],
  "cuisines": ["pizza"],
  "sortBy": "RELEVANCE",
  "maxResults": 1,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"],
    "apifyProxyCountry": "IN"
  }
}
```

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `cities` | array | yes | `["Bangalore"]` | Cities to scrape. Use one city for tests. |
| `localities` | array | no | `[]` | Optional areas within the city. Leave empty to search the city page. |
| `cuisines` | array | no | `["pizza"]` | Cuisine filters such as pizza, Chinese, North Indian, Biryani, or South Indian. |
| `sortBy` | string | no | `RELEVANCE` | Preferred result sorting when Swiggy exposes sorting controls. |
| `maxResults` | integer | no | `1` | Maximum unique restaurant records to save. Start with one result. |
| `proxyConfiguration` | object | no | India residential | Proxy settings recommended for regional access. |

## Output dataset

```json
{
  "source": "swiggy",
  "imageUrl": "https://media-assets.swiggy.com/swiggy/image/upload/...",
  "searchCity": "Bangalore",
  "searchLocality": null,
  "searchCuisine": "pizza",
  "position": 1,
  "restaurantId": "10575",
  "restaurantName": "Pizza Hut",
  "cuisineTypes": ["Pizzas"],
  "costForTwo": "INR 600 for two",
  "priceForTwo": 600,
  "overallRating": 4.3,
  "totalRatingsCount": 12000,
  "deliveryTimeEstimate": 30,
  "distance": "2.6 km",
  "offersAndDiscounts": ["20% off"],
  "pureVeg": false,
  "openClosedStatus": true,
  "locality": "Richmond Town",
  "city": "Bangalore",
  "promotedSponsored": false,
  "restaurantUrl": "https://www.swiggy.com/restaurants/pizza-hut-10575",
  "scrapedAt": "2026-06-21T13:46:45.000Z"
}
```

## How to Scrape Swiggy Restaurants

1. Enter one Indian city, for example `Bangalore`, `Mumbai`, `Delhi`, `Pune`, or `Hyderabad`.
2. Optionally add one locality or cuisine filter.
3. Set `maxResults` to `1` for the first run.
4. Run the Actor.
5. Export results as JSON, CSV, Excel, or via API.

## Notes

- Swiggy pages can vary by city, locality, and region.
- Some fields may be `null` when Swiggy does not show them on the listing page.
- India residential proxies are recommended for reliable regional access.

## Responsible Use

This Actor is intended for lawful collection of publicly available information only. Users are responsible for ensuring their use complies with the source website's terms, robots.txt, applicable privacy laws, including India's DPDP Act, and all local regulations.

Do not use this Actor to collect, store, sell, or misuse personal data without a lawful basis. The Actor author is not responsible for misuse by end users.

## License

Apache-2.0
