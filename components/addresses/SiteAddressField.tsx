"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import {
  ADDRESS_PRIMARY_TYPES,
  ADDRESS_SEARCH_FILLED,
  ADDRESS_SEARCH_INCOMPLETE,
  ADDRESS_SEARCH_NO_MATCH,
  ADDRESS_SEARCH_UNAVAILABLE,
  formatSiteAddress,
  includedRegionCodes,
  mapAddressComponents,
  placesBrowserKeyConfigured,
  shouldApplyPlaceSelection,
  type AddressCountryCode,
} from "@/lib/addresses/map-place";
import {
  loadPlacesLibrary,
  PLACE_DETAIL_FIELDS,
  type PlacesSuggestion,
} from "@/lib/addresses/places-loader";
import { cn } from "@/lib/utils";

type SiteAddressFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  countryCode?: AddressCountryCode | null;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-invalid"?: boolean;
};

type ListPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const MIN_QUERY = 3;

/**
 * Suggestions for the existing single site field.
 * The data API is used here so Start a job keeps one field. The widget would
 * add a second control. Session tokens are created per search and discarded
 * after Place.fetchFields, a country change, or an abandoned query.
 */
export function SiteAddressField({
  id,
  value,
  onChange,
  countryCode = null,
  maxLength = 300,
  placeholder,
  className,
  autoComplete = "street-address",
  disabled = false,
  readOnly = false,
  "aria-invalid": ariaInvalid,
}: SiteAddressFieldProps) {
  const listId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef(countryCode);
  const generationRef = useRef(0);
  const latestRequestRef = useRef(0);
  const sessionRef = useRef<object | null>(null);
  const timerRef = useRef<number | null>(null);
  const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<string | null>(null);
  const [position, setPosition] = useState<ListPosition | null>(null);
  const configured = placesBrowserKeyConfigured() && !disabled && !readOnly;
  const listOpen = open && value.trim().length >= MIN_QUERY;
  const visibleStatus =
    value.trim() === "" && status === ADDRESS_SEARCH_FILLED ? null : status;

  useLayoutEffect(() => {
    countryRef.current = countryCode;
    generationRef.current += 1;
    sessionRef.current = null;
  }, [countryCode]);

  function abandonSession() {
    sessionRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!listOpen) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    document.addEventListener("keydown", onEscape, true);
    return () => document.removeEventListener("keydown", onEscape, true);
  }, [listOpen]);

  useEffect(() => {
    if (!listOpen) return;
    function update() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const width = Math.min(rect.width, window.innerWidth - margin * 2);
      let left = rect.left;
      if (left + width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - margin - width);
      }
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(44, Math.min(240, openUp ? spaceAbove : spaceBelow));
      const top = openUp ? rect.top - 4 - maxHeight : rect.bottom + 4;
      setPosition({ top, left, width, maxHeight });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [listOpen, suggestions.length]);

  useEffect(() => {
    if (!listOpen || activeIndex < 0) return;
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId, listOpen]);

  function schedule(query: string) {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const generation = generationRef.current;
    if (!configured || query.trim().length < MIN_QUERY) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      if (query.trim().length < MIN_QUERY) abandonSession();
      return;
    }
    timerRef.current = window.setTimeout(() => {
      void fetchSuggestions(query.trim(), generation);
    }, 300);
  }

  async function fetchSuggestions(query: string, generation: number) {
    const requestId = ++latestRequestRef.current;
    try {
      const places = await loadPlacesLibrary();
      if (!places || generationRef.current !== generation || requestId !== latestRequestRef.current) {
        return;
      }
      sessionRef.current ??= new places.AutocompleteSessionToken();
      const country = countryRef.current;
      const { suggestions: next } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: sessionRef.current,
        includedRegionCodes: includedRegionCodes(country),
        includedPrimaryTypes: [...ADDRESS_PRIMARY_TYPES],
        language: "en",
        ...(country ? { region: country.toLowerCase() } : {}),
      });
      if (generationRef.current !== generation || requestId !== latestRequestRef.current) return;
      const rows = next.filter((item) => item.placePrediction);
      setSuggestions(rows);
      setActiveIndex(rows.length > 0 ? 0 : -1);
      setOpen(true);
      setStatus(rows.length === 0 ? ADDRESS_SEARCH_NO_MATCH : null);
    } catch {
      if (generationRef.current !== generation || requestId !== latestRequestRef.current) return;
      abandonSession();
      setSuggestions([]);
      setOpen(false);
      setStatus(ADDRESS_SEARCH_UNAVAILABLE);
    }
  }

  async function choose(row: PlacesSuggestion, generation: number) {
    const prediction = row.placePrediction;
    if (!prediction) return;
    const countryAtRequest = countryRef.current;
    const tokenAtSelect = sessionRef.current;
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: PLACE_DETAIL_FIELDS });
      if (sessionRef.current === tokenAtSelect) sessionRef.current = null;
      if (generationRef.current !== generation) return;
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
        setOpen(false);
        return;
      }
      const line = formatSiteAddress(mapped, maxLength);
      if (!line) {
        setStatus(ADDRESS_SEARCH_INCOMPLETE);
        setOpen(false);
        return;
      }
      onChange(line);
      setStatus(ADDRESS_SEARCH_FILLED);
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
    } catch {
      if (sessionRef.current === tokenAtSelect) sessionRef.current = null;
      if (generation !== generationRef.current) return;
      setStatus(ADDRESS_SEARCH_UNAVAILABLE);
      setOpen(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && listOpen) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (!configured) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (suggestions.length === 0) {
        schedule(value);
        return;
      }
      if (!listOpen) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
      return;
    }
    if (event.key === "ArrowUp" && listOpen) {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && listOpen && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      void choose(suggestions[activeIndex], generationRef.current);
    }
  }

  const list =
    listOpen && position && typeof document !== "undefined"
      ? createPortal(
          <ul
            id={listId}
            role="listbox"
            aria-label="Address suggestions"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className="fixed z-[80] overflow-auto rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground" role="presentation">
                {visibleStatus ?? ADDRESS_SEARCH_NO_MATCH}
              </li>
            ) : (
              suggestions.map((suggestion, index) => {
                const label = suggestion.placePrediction?.text.toString() ?? "";
                const selected = index === activeIndex;
                return (
                  <li key={`${label}-${index}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      id={`${listId}-${index}`}
                      aria-selected={selected}
                      className={cn(
                        "min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm break-words",
                        selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        void choose(suggestion, generationRef.current);
                      }}
                    >
                      {label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={anchorRef} className="min-w-0" data-site-address-field>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={ariaInvalid}
        aria-autocomplete={configured ? "list" : undefined}
        aria-expanded={configured ? listOpen : undefined}
        aria-controls={configured && listOpen ? listId : undefined}
        aria-activedescendant={
          configured && listOpen && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        role={configured ? "combobox" : undefined}
        autoComplete={configured ? "off" : autoComplete}
        autoCorrect={configured ? "off" : undefined}
        spellCheck={configured ? false : undefined}
        className={className}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
          setStatus(null);
          generationRef.current += 1;
          setSuggestions([]);
          setActiveIndex(-1);
          setOpen(false);
          schedule(next);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {visibleStatus ? (
        <p className="pt-1 text-xs text-muted-foreground" role="status">
          {visibleStatus}
        </p>
      ) : null}
      {list}
    </div>
  );
}
