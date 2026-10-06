/**
 * Address suggestion mapping. Static only. Does not call Google or Production.
 *
 * Run: npx --yes tsx scripts/verify-address-places.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ADDRESS_DETAIL_FIELDS,
  ADDRESS_PRIMARY_TYPES,
  draftFromSelection,
  formatSiteAddress,
  includedRegionCodes,
  mapAddressComponents,
  shouldApplyPlaceSelection,
  type AddressComponentInput,
  type MappedAddress,
  type StructuredAddressDraft,
} from "../lib/addresses/map-place";
import { formatCompanyAddress } from "../lib/quotes/display";
import type { CompanySettings } from "../lib/settings/types";

const root = join(__dirname, "..");
let failed = 0;

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

function assert(name: string, ok: boolean): void {
  if (ok) {
    console.log(`PASS  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL  ${name}`);
}

function component(
  type: string,
  longText: string,
  shortText = longText
): AddressComponentInput {
  return { types: [type], longText, shortText };
}

const nzUnit: AddressComponentInput[] = [
  component("subpremise", "2"),
  component("street_number", "12"),
  component("route", "Queen Street"),
  component("sublocality_level_1", "Auckland CBD"),
  component("locality", "Auckland"),
  component("administrative_area_level_1", "Auckland"),
  component("postal_code", "1010"),
  component("country", "New Zealand", "NZ"),
];

const auUnit: AddressComponentInput[] = [
  component("subpremise", "Level 4"),
  component("street_number", "100"),
  component("route", "George Street"),
  component("locality", "Sydney"),
  component("administrative_area_level_1", "New South Wales", "NSW"),
  component("postal_code", "2000"),
  component("country", "Australia", "AU"),
];

const auSuburb: AddressComponentInput[] = [
  component("street_number", "8"),
  component("route", "Crown Street"),
  component("locality", "Surry Hills"),
  component("administrative_area_level_1", "New South Wales", "NSW"),
  component("postal_code", "2010"),
  component("country", "Australia", "AU"),
];

const nzTown: AddressComponentInput[] = [
  component("street_number", "123"),
  component("route", "Main Road"),
  component("locality", "Raglan"),
  component("administrative_area_level_1", "Waikato"),
  component("postal_code", "3225"),
  component("country", "New Zealand", "NZ"),
];

const missingParts: AddressComponentInput[] = [
  component("route", "Main Road"),
  component("country", "New Zealand", "NZ"),
];

const boundary: AddressComponentInput[] = [
  component("street_number", "1"),
  component("route", "Wharf Street"),
  component("locality", "Tweed Heads"),
  { types: ["political"], longText: "Queensland", shortText: "QLD" },
  component("administrative_area_level_1", "New South Wales", "NSW"),
  component("postal_code", "2485"),
  component("country", "Australia", "AU"),
];

const nzBoundary: AddressComponentInput[] = [
  component("street_number", "1"),
  component("route", "Riverbank Road"),
  component("locality", "Mercer"),
  { types: ["political"], longText: "Auckland", shortText: "Auckland" },
  component("administrative_area_level_1", "Waikato"),
  component("postal_code", "2478"),
  component("country", "New Zealand", "NZ"),
];

function expectMapped(name: string, mapped: MappedAddress, expected: MappedAddress): void {
  assert(
    name,
    mapped.street === expected.street &&
      mapped.unit === expected.unit &&
      mapped.suburbOrCity === expected.suburbOrCity &&
      mapped.region === expected.region &&
      mapped.postcode === expected.postcode &&
      mapped.country === expected.country &&
      mapped.countryCode === expected.countryCode
  );
}

const blank: StructuredAddressDraft = {
  street: "",
  unit: "",
  suburbOrCity: "",
  region: "",
  postcode: "",
  country: "New Zealand",
};

function main(): void {
  console.log("=== address places ===\n");

  const queen = mapAddressComponents(nzUnit);
  expectMapped("NZ unit, street, suburb, city, postcode", queen, {
    street: "12 Queen Street",
    unit: "Unit 2",
    suburbOrCity: "Auckland CBD",
    region: "Auckland",
    postcode: "1010",
    country: "New Zealand",
    countryCode: "NZ",
  });
  assert(
    "NZ site line keeps the unit and drops the repeated city",
    formatSiteAddress(queen) === "12 Queen Street, Unit 2, Auckland CBD, Auckland, 1010, New Zealand"
  );

  const george = mapAddressComponents(auUnit);
  expectMapped("AU level, street, city, state, postcode", george, {
    street: "100 George Street",
    unit: "Level 4",
    suburbOrCity: "Sydney",
    region: "NSW",
    postcode: "2000",
    country: "Australia",
    countryCode: "AU",
  });

  const surry = mapAddressComponents(auSuburb);
  expectMapped("AU suburb uses locality and state abbreviation", surry, {
    street: "8 Crown Street",
    unit: "",
    suburbOrCity: "Surry Hills",
    region: "NSW",
    postcode: "2010",
    country: "Australia",
    countryCode: "AU",
  });

  const raglan = mapAddressComponents(nzTown);
  expectMapped("NZ town without a suburb uses locality and region", raglan, {
    street: "123 Main Road",
    unit: "",
    suburbOrCity: "Raglan",
    region: "Waikato",
    postcode: "3225",
    country: "New Zealand",
    countryCode: "NZ",
  });

  const incomplete = mapAddressComponents(missingParts);
  expectMapped("missing unit, suburb, region and postcode stay empty", incomplete, {
    street: "Main Road",
    unit: "",
    suburbOrCity: "",
    region: "",
    postcode: "",
    country: "New Zealand",
    countryCode: "NZ",
  });

  const tweed = mapAddressComponents(boundary);
  expectMapped("AU border address uses its own state, not the neighbour", tweed, {
    street: "1 Wharf Street",
    unit: "",
    suburbOrCity: "Tweed Heads",
    region: "NSW",
    postcode: "2485",
    country: "Australia",
    countryCode: "AU",
  });

  const mercer = mapAddressComponents(nzBoundary);
  expectMapped("NZ border address uses its own region, not the neighbour", mercer, {
    street: "1 Riverbank Road",
    unit: "",
    suburbOrCity: "Mercer",
    region: "Waikato",
    postcode: "2478",
    country: "New Zealand",
    countryCode: "NZ",
  });

  assert("empty components do not invent an address", !shouldApplyPlaceSelection({
    requestGeneration: 1,
    currentGeneration: 1,
    countryAtRequest: "NZ",
    currentCountry: "NZ",
    mapped: mapAddressComponents([]),
  }));

  const filled = draftFromSelection(blank, queen, { lockCountry: true });
  const corrected = { ...filled, street: "12 Queen Street West" };
  let generation = 1;
  generation += 1;
  assert(
    "a later search does not overwrite a corrected street",
    !shouldApplyPlaceSelection({
      requestGeneration: 1,
      currentGeneration: generation,
      countryAtRequest: "NZ",
      currentCountry: "NZ",
      mapped: queen,
    }) && corrected.street === "12 Queen Street West"
  );

  assert(
    "changing country drops an in-flight selection",
    !shouldApplyPlaceSelection({
      requestGeneration: 4,
      currentGeneration: 4,
      countryAtRequest: "NZ",
      currentCountry: "AU",
      mapped: queen,
    })
  );

  assert(
    "a place from the other country is not applied over the selected country",
    !shouldApplyPlaceSelection({
      requestGeneration: 2,
      currentGeneration: 2,
      countryAtRequest: "NZ",
      currentCountry: "NZ",
      mapped: tweed,
    })
  );

  assert(
    "rapid earlier responses are ignored",
    !shouldApplyPlaceSelection({
      requestGeneration: 1,
      currentGeneration: 3,
      countryAtRequest: null,
      currentCountry: null,
      mapped: raglan,
    })
  );

  assert(
    "the current response can fill the fields",
    shouldApplyPlaceSelection({
      requestGeneration: 3,
      currentGeneration: 3,
      countryAtRequest: null,
      currentCountry: null,
      mapped: raglan,
    })
  );

  assert("known country restricts suggestions to that country", includedRegionCodes("NZ").join() === "nz");
  assert("unknown country stays inside NZ and AU", includedRegionCodes(null).join() === "nz,au");
  assert(
    "details request is address components only",
    ADDRESS_DETAIL_FIELDS.join() === "addressComponents" &&
      ADDRESS_PRIMARY_TYPES.join() === "street_address,premise,subpremise,route"
  );

  const issued = formatCompanyAddress({
    addressLine1: "12 Quay Street",
    addressLine2: "Level 2",
    city: "Auckland",
    region: "Auckland",
    postcode: "1010",
    addressCountry: "New Zealand",
  } as CompanySettings);
  assert(
    "issued company formatting still reads stored fields",
    issued === "12 Quay Street, Level 2, Auckland, Auckland, 1010"
  );

  const onboarding = read("components/setup/BusinessAddressStep.tsx");
  const company = read("components/settings/CompanySettingsContent.tsx");
  const create = read("components/projects/NewProjectDialog.tsx");
  const edit = read("components/projects/EditProjectDialog.tsx");
  const pricing = read("components/pricing/PricingDetailsCard.tsx");
  const search = read("components/addresses/AddressSearch.tsx");
  const site = read("components/addresses/SiteAddressField.tsx");
  const loader = read("lib/addresses/places-loader.ts");
  const customers = read("components/customers/CustomerFormDialog.tsx");
  const quoteSnapshot = read("lib/quotes/issuer-snapshot.ts");
  const quoteBuild = read("lib/quotes/build-from-pricing.ts");
  const variation = read("lib/variations/document-identity.ts");
  const notes = read("lib/project-notes/build-analysis-source.ts");
  const setupActions = read("lib/setup/actions.ts");
  const projectActions = read("lib/projects/actions.ts");

  assert("onboarding search fills the existing fields and does not save the query", onboarding.includes("AddressSearch") && onboarding.includes("setAddressLine1(mapped.street)") && !onboarding.includes("placeId"));
  assert("company search is an edit affordance", company.includes("AddressSearch") && company.includes("canEdit"));
  assert("start a job keeps one site field", create.includes('htmlFor="site-address"') && create.includes("SiteAddressField") && create.includes("...(site ? { site_address: site } : {})") && create.includes("Start a job") && !create.includes("addressLine1"));
  assert("edit project uses the same site field", edit.includes('htmlFor="edit-site-address"') && edit.includes("SiteAddressField"));
  assert("pricing site entry uses the same field and still writes site_address", pricing.includes("SiteAddressField") && pricing.includes("site_address"));
  assert("customers have no address search", !customers.includes("AddressSearch") && !customers.includes("SiteAddressField"));
  assert("widget requests address components and handles API failure", search.includes("PLACE_DETAIL_FIELDS") && search.includes("gmp-error") && search.includes("ADDRESS_SEARCH_UNAVAILABLE"));
  assert("site field uses a session token and does not clear the typed value on failure", site.includes("AutocompleteSessionToken") && site.includes("sessionRef.current = null") && !site.includes('onChange("")'));
  assert("keyboard and touch selection stay on the site field", site.includes("ArrowDown") && site.includes("Enter") && site.includes("Escape") && site.includes('"combobox"') && site.includes("onPointerDown"));
  assert("loader does not log the browser key", !loader.includes("console."));
  assert("quote issuer snapshot is unchanged", quoteSnapshot.includes("addressLine1: snapshot.addressLine1") && !quoteSnapshot.includes("place"));
  assert("quote site still comes from the pricing or project copy", quoteBuild.includes("document.site_address ?? projectSiteAddress"));
  assert("variation identity still reads the stored snapshot", variation.includes("formatCompanyAddress") && !variation.includes("mapAddressComponents"));
  assert("estimate site notes are not an address search", !notes.includes("mapAddressComponents") && !notes.includes("AddressSearch"));
  assert("onboarding save still requires company.edit and the stored columns", setupActions.includes('permission: "company.edit"') && setupActions.includes("address_line_1: addressLine1"));
  assert("project create permission is unchanged", /export async function createProject[\s\S]{0,900}permission: "projects.create"/.test(projectActions));

  if (failed > 0) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\naddress place checks passed");
}

main();
