"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  ADDRESS_PRIMARY_TYPES,
  ADDRESS_SEARCH_FILLED,
  ADDRESS_SEARCH_INCOMPLETE,
  ADDRESS_SEARCH_UNAVAILABLE,
  includedRegionCodes,
  mapAddressComponents,
  placesBrowserKeyConfigured,
  shouldApplyPlaceSelection,
  type AddressCountryCode,
  type MappedAddress,
} from "@/lib/addresses/map-place";
import {
  loadPlacesLibrary,
  PLACE_DETAIL_FIELDS,
  type PlacesAutocompleteElement,
} from "@/lib/addresses/places-loader";

type AddressSearchProps = {
  countryCode: AddressCountryCode | null;
  disabled?: boolean;
  onAddress: (address: MappedAddress) => void;
};

function sameText(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/**
 * Places Autocomplete (New) widget. It sits above the existing fields.
 * The widget owns the autocomplete session. A selection fills the fields;
 * the search text itself is not saved.
 */
export function AddressSearch({ countryCode, disabled = false, onAddress }: AddressSearchProps) {
  const searchId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const onAddressRef = useRef(onAddress);
  const countryRef = useRef(countryCode);
  const generationRef = useRef(0);
  const [unavailable, setUnavailable] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const configured = placesBrowserKeyConfigured();

  useLayoutEffect(() => {
    onAddressRef.current = onAddress;
  });

  useLayoutEffect(() => {
    countryRef.current = countryCode;
    generationRef.current += 1;
  }, [countryCode]);

  useEffect(() => {
    if (!configured || disabled) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let element: PlacesAutocompleteElement | null = null;
    let acceptedPrediction = "";

    const onInput = () => {
      const value = element?.value ?? "";
      if (acceptedPrediction && sameText(value, acceptedPrediction)) return;
      acceptedPrediction = "";
      generationRef.current += 1;
      setStatus(null);
    };

    const onError = () => {
      setUnavailable(true);
      setStatus(ADDRESS_SEARCH_UNAVAILABLE);
    };

    const onSelect = (event: Event) => {
      const selectEvent = event as Event & {
        placePrediction?: {
          text?: { toString(): string };
          toPlace?: () => {
            addressComponents?: Parameters<typeof mapAddressComponents>[0];
            fetchFields: (request: { fields: readonly string[] }) => Promise<void>;
          };
        };
      };
      const prediction = selectEvent.placePrediction;
      const place = prediction?.toPlace?.();
      if (!place) return;
      const generation = generationRef.current;
      const countryAtRequest = countryRef.current;
      const predictionText = prediction?.text?.toString() ?? "";
      acceptedPrediction = predictionText;
      void place
        .fetchFields({ fields: PLACE_DETAIL_FIELDS })
        .then(() => {
          if (cancelled || generationRef.current !== generation) return;
          if (countryRef.current !== countryAtRequest) return;
          const currentValue = element?.value ?? "";
          if (
            predictionText &&
            currentValue.trim() &&
            !sameText(currentValue, predictionText)
          ) {
            return;
          }
          const mapped = mapAddressComponents(place.addressComponents);
          if (
            !shouldApplyPlaceSelection({
              requestGeneration: generation,
              currentGeneration: generationRef.current,
              countryAtRequest,
              currentCountry: countryRef.current,
              mapped,
            })
          ) {
            setStatus(ADDRESS_SEARCH_INCOMPLETE);
            return;
          }
          onAddressRef.current(mapped);
          setStatus(ADDRESS_SEARCH_FILLED);
        })
        .catch(() => {
          if (cancelled || generationRef.current !== generation) return;
          setStatus(ADDRESS_SEARCH_UNAVAILABLE);
        });
    };

    void loadPlacesLibrary().then((places) => {
      if (cancelled || !hostRef.current) return;
      if (!places) {
        setUnavailable(true);
        setStatus(ADDRESS_SEARCH_UNAVAILABLE);
        return;
      }
      const country = countryRef.current;
      element = new places.PlaceAutocompleteElement({
        includedRegionCodes: includedRegionCodes(country),
        includedPrimaryTypes: [...ADDRESS_PRIMARY_TYPES],
        requestedLanguage: "en",
        ...(country ? { requestedRegion: country.toLowerCase() } : {}),
      });
      element.id = searchId;
      element.placeholder = "Search for an address";
      element.description =
        "Optional. Choosing a suggestion fills the address fields. You can edit every field before saving.";
      element.noInputIcon = true;
      element.classList.add("quotr-address-search");
      element.addEventListener("input", onInput);
      element.addEventListener("gmp-select", onSelect);
      element.addEventListener("gmp-error", onError);
      host.replaceChildren(element);
    });

    return () => {
      cancelled = true;
      generationRef.current += 1;
      element?.removeEventListener("input", onInput);
      element?.removeEventListener("gmp-select", onSelect);
      element?.removeEventListener("gmp-error", onError);
      host.replaceChildren();
    };
  }, [configured, countryCode, disabled, searchId]);

  if (!configured || disabled || unavailable) {
    return status ? (
      <p className="text-xs text-muted-foreground" role="status">
        {status}
      </p>
    ) : null;
  }

  return (
    <div
      className="space-y-1.5"
      data-address-search
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
    >
      <Label htmlFor={searchId}>Search address</Label>
      <div ref={hostRef} className="min-h-11 w-full min-w-0" />
      <p className="text-xs text-muted-foreground">
        Optional. You can still type the address below.
      </p>
      {status ? (
        <p className="text-xs text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
