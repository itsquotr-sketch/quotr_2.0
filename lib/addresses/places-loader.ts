"use client";

import { ADDRESS_DETAIL_FIELDS } from "@/lib/addresses/map-place";

export type PlacesAutocompleteElement = HTMLElement & {
  placeholder: string;
  description: string;
  value: string;
  includedRegionCodes: string[];
  includedPrimaryTypes: string[];
  requestedLanguage?: string;
  requestedRegion?: string;
  noInputIcon?: boolean;
};

export type PlacesPrediction = {
  text: { toString(): string };
  toPlace: () => PlacesPlace;
};

export type PlacesPlace = {
  addressComponents?:
    | {
        types?: string[] | null;
        longText?: string | null;
        shortText?: string | null;
      }[]
    | null;
  fetchFields: (request: { fields: readonly string[] }) => Promise<void>;
};

export type PlacesSuggestion = {
  placePrediction: PlacesPrediction | null;
};

export type PlacesLibrary = {
  PlaceAutocompleteElement: new (options?: {
    includedRegionCodes?: string[];
    includedPrimaryTypes?: string[];
    requestedLanguage?: string;
    requestedRegion?: string;
  }) => PlacesAutocompleteElement;
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (request: {
      input: string;
      sessionToken?: object;
      includedRegionCodes?: string[];
      includedPrimaryTypes?: string[];
      language?: string;
      region?: string;
    }) => Promise<{ suggestions: PlacesSuggestion[] }>;
  };
};

type MapsNamespace = {
  importLibrary?: (name: "places") => Promise<PlacesLibrary>;
};

declare global {
  interface Window {
    google?: { maps?: MapsNamespace };
  }
}

let loading: Promise<PlacesLibrary | null> | null = null;

function browserKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

/**
 * Official Maps JavaScript bootstrap. The key is a referrer-restricted browser
 * key and is not logged. Sessions for the widget are managed inside
 * PlaceAutocompleteElement. Data API callers pass AutocompleteSessionToken.
 */
function installBootstrap(key: string): void {
  if (window.google?.maps?.importLibrary) return;

  const googleName = "google";
  const callbackName = "__ib__";
  const root = window as unknown as Record<string, Record<string, unknown>>;
  const google = (root[googleName] ??= {});
  const mapsNamespace = (google.maps ??= {}) as MapsNamespace & {
    __ib__?: () => void;
  };
  const libraries = new Set<string>();
  let loader: Promise<void> | undefined;
  let bridge: ((library: string, ...args: unknown[]) => Promise<unknown>) | null = null;

  const load = () => {
    if (loader) return loader;
    loader = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      const params = new URLSearchParams();
      params.set("libraries", [...libraries].join(","));
      params.set("key", key);
      params.set("v", "weekly");
      params.set("callback", `${googleName}.maps.${callbackName}`);
      script.src = `https://maps.${googleName}apis.com/maps/api/js?${params.toString()}`;
      mapsNamespace.__ib__ = () => resolve();
      script.onerror = () => reject(new Error("Maps JavaScript could not load."));
      const nonce = document.querySelector("script[nonce]")?.getAttribute("nonce");
      if (nonce) script.setAttribute("nonce", nonce);
      document.head.append(script);
    });
    return loader;
  };

  bridge = (library: string, ...args: unknown[]) => {
    libraries.add(library);
    return load().then(() => {
      const current = window.google?.maps?.importLibrary;
      if (!current || current === bridge) {
        throw new Error("Maps library did not initialize.");
      }
      return current(library as "places", ...(args as []));
    });
  };
  mapsNamespace.importLibrary = bridge as MapsNamespace["importLibrary"];
}

export function loadPlacesLibrary(): Promise<PlacesLibrary | null> {
  if (!browserKey() || typeof window === "undefined") return Promise.resolve(null);
  if (!loading) {
    loading = (async () => {
      try {
        installBootstrap(browserKey());
        const places = await window.google?.maps?.importLibrary?.("places");
        if (!places?.PlaceAutocompleteElement || !places.AutocompleteSuggestion) return null;
        return places;
      } catch {
        return null;
      }
    })();
  }
  return loading;
}

export const PLACE_DETAIL_FIELDS = ADDRESS_DETAIL_FIELDS;
