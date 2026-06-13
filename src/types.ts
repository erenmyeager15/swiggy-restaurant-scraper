export interface ActorInput {
  cities: string[];
  localities?: string[];
  cuisines?: string[];
  sortBy?: 'RELEVANCE' | 'RATING' | 'DELIVERY_TIME' | 'COST_LOW_TO_HIGH' | 'COST_HIGH_TO_LOW';
  scrapeMenuSummary?: boolean;
  maxResults?: number;
  proxyConfiguration?: {
    useApifyProxy?: boolean;
    apifyProxyGroups?: string[];
    apifyProxyCountry?: string;
  };
}

export interface SwiggyRestaurantInfo {
  id: string | number;
  name?: string;
  slug?: string;
  cloudinaryImageId?: string;
  locality?: string;
  areaName?: string;
  costForTwo?: string;
  cuisines?: string[];
  avgRating?: string | number;
  avgRatingString?: string;
  totalRatings?: string | number;
  totalRatingsString?: string;
  veg?: boolean;
  isPureVeg?: boolean;
  isOpen?: boolean;
  adTrackingId?: string;
  sla?: {
    deliveryTime?: number;
    lastMileTravel?: number;
    lastMileTravelString?: string;
    slaString?: string;
  };
  availability?: {
    opened?: boolean;
  };
  aggregatedDiscountInfoV3?: {
    header?: string;
    subHeader?: string;
    discountTag?: string;
  };
  aggregatedDiscountInfoV2?: {
    descriptionList?: Array<{
      meta?: string;
      description?: string;
    }>;
  };
}

export interface RestaurantRecord {
  source: 'swiggy';
  imageUrl: string | null;
  searchCity: string;
  searchLocality: string | null;
  searchCuisine: string | null;
  position: number;
  restaurantId: string;
  restaurantName: string;
  cuisineTypes: string[];
  costForTwo: string | null;
  priceForTwo: number | null;
  overallRating: number | null;
  totalRatingsCount: number | null;
  deliveryTimeEstimate: number | null;
  distance: string | null;
  offersAndDiscounts: string[];
  pureVeg: boolean;
  openClosedStatus: boolean;
  restaurantUrl: string;
  locality: string | null;
  city: string;
  promotedSponsored: boolean;
  scrapedAt: string;
}
