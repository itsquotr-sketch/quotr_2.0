"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubcontractorCreateDialog } from "@/components/subcontractors/SubcontractorCreateDialog";
import {
  ArchiveSubcontractorButton,
  RestoreSubcontractorButton,
} from "@/components/subcontractors/SubcontractorFormDialog";
import { SCOPE_CATALOGUE, SCOPE_CATEGORIES } from "@/lib/scopes/catalogue";
import { filterSubcontractors } from "@/lib/subcontractors/search";
import type {
  Subcontractor,
  SubcontractorContact,
  SubcontractorCountryCode,
} from "@/lib/subcontractors/types";
import { workAreaLabels } from "@/lib/subcontractors/work-areas";

type SubcontractorsDirectoryProps = {
  subcontractors: Subcontractor[];
  archived: boolean;
  canEdit: boolean;
  organisationCountry: SubcontractorCountryCode | null;
};

const selectClass =
  "h-11 min-h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm sm:max-w-xs";

const ROW_GRID =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.15fr)_6.5rem_minmax(11.5rem,auto)] items-center gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.15fr)_6.5rem_minmax(11.5rem,auto)]";

function primaryContact(subcontractor: Subcontractor): SubcontractorContact | null {
  return (
    subcontractor.contacts.find((contact) => contact.is_primary) ??
    subcontractor.contacts[0] ??
    null
  );
}

function contactLine(contact: SubcontractorContact | null): string {
  if (!contact) return "No contact yet";
  const reach = contact.email ?? contact.phone;
  return reach ? `${contact.name} · ${reach}` : contact.name;
}

function StatusBadge({ archived }: { archived: boolean }) {
  return (
    <Badge variant={archived ? "secondary" : "outline"}>
      {archived ? "Archived" : "Active"}
    </Badge>
  );
}

function profileHref(subcontractor: Subcontractor): string {
  return `/app/contacts/subcontractors/${subcontractor.id}`;
}

function SubcontractorActions({
  subcontractor,
  archived,
  canEdit,
}: {
  subcontractor: Subcontractor;
  archived: boolean;
  canEdit: boolean;
}) {
  if (!canEdit) return null;
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {archived ? (
        <RestoreSubcontractorButton subcontractorId={subcontractor.id} />
      ) : (
        <>
          <Button
            variant="outline"
            size="touch"
            render={<Link href={profileHref(subcontractor)} />}
          >
            Edit
          </Button>
          <ArchiveSubcontractorButton subcontractor={subcontractor} />
        </>
      )}
    </div>
  );
}

export function SubcontractorsDirectory({
  subcontractors,
  archived,
  canEdit,
  organisationCountry,
}: SubcontractorsDirectoryProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [workArea, setWorkArea] = useState("");
  const visible = useMemo(
    () => filterSubcontractors(subcontractors, search, workArea),
    [subcontractors, search, workArea]
  );
  const emptyDirectory = subcontractors.length === 0;
  const emptyFilter = !emptyDirectory && visible.length === 0;

  return (
    <div className="flex flex-col gap-4" data-subcontractors-directory>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="block min-w-0 flex-1">
            <span className="sr-only">Search subcontractors</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search trading name, contact, email or phone"
              className="min-h-11"
              autoComplete="off"
              data-subcontractor-search
            />
          </label>
          <label className="block min-w-0">
            <span className="sr-only">Filter by work area</span>
            <select
              value={workArea}
              onChange={(event) => setWorkArea(event.target.value)}
              className={selectClass}
              data-subcontractor-work-area
            >
              <option value="">All work areas</option>
              {SCOPE_CATEGORIES.map((category) => (
                <optgroup key={category} label={category}>
                  {SCOPE_CATALOGUE.filter((item) => item.category === category).map(
                    (item) => (
                      <option key={item.type} value={item.type}>
                        {item.label}
                      </option>
                    )
                  )}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-orange)]">
          <input
            type="checkbox"
            checked={archived}
            onChange={() => {
              router.push(
                archived
                  ? "/app/contacts/subcontractors"
                  : "/app/contacts/subcontractors?archived=1"
              );
            }}
            className="size-4 accent-[var(--brand-orange)]"
          />
          <span className="text-sm font-medium">Show archived</span>
        </label>
      </div>

      {emptyDirectory ? (
        <div className="rounded-xl border border-border/60 bg-card px-4 py-10 text-center">
          <p className="text-base font-medium">
            {archived ? "No archived subcontractors" : "No subcontractors yet"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {archived
              ? "Archived businesses stay on record with their contacts. Nothing is deleted."
              : "Add a business and the people you contact there. Work areas help you find them later. They are not rates."}
          </p>
          {!archived && canEdit ? (
              <div className="mt-4 flex justify-center">
              <SubcontractorCreateDialog organisationCountry={organisationCountry} />
            </div>
          ) : null}
        </div>
      ) : null}

      {emptyFilter ? (
        <p className="rounded-xl border border-border/60 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No subcontractors match that search or work area.
        </p>
      ) : null}

      {visible.length > 0 ? (
        <>
          <div
            className="hidden overflow-hidden rounded-xl border border-border/60 bg-card md:block"
            data-subcontractor-list="aligned"
          >
            <div
              className={`${ROW_GRID} border-b px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase`}
            >
              <span>Business</span>
              <span className="hidden lg:block">Work areas</span>
              <span>Primary contact</span>
              <span>Status</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul>
              {visible.map((subcontractor) => {
                const areas = workAreaLabels(subcontractor.work_area_types);
                const contact = contactLine(primaryContact(subcontractor));
                return (
                  <li
                    key={subcontractor.id}
                    className={`${ROW_GRID} border-b px-4 py-2 last:border-b-0`}
                    data-subcontractor-row
                  >
                    <div className="min-w-0">
                      <Link
                        href={profileHref(subcontractor)}
                        className="block truncate font-medium underline-offset-2 hover:underline"
                        title={subcontractor.trading_name}
                      >
                        {subcontractor.trading_name}
                      </Link>
                      {areas ? (
                        <p className="truncate text-sm text-muted-foreground lg:hidden" title={areas}>
                          {areas}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground lg:hidden">No work area yet</p>
                      )}
                    </div>
                    <p className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block" title={areas}>
                      {areas || "No work area yet"}
                    </p>
                    <p className="min-w-0 truncate text-sm text-muted-foreground" title={contact}>
                      {contact}
                    </p>
                    <StatusBadge archived={archived} />
                    <SubcontractorActions
                      subcontractor={subcontractor}
                      archived={archived}
                      canEdit={canEdit}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
          <ul className="flex flex-col gap-3 md:hidden" data-subcontractor-list="stacked">
            {visible.map((subcontractor) => {
              const areas = workAreaLabels(subcontractor.work_area_types);
              const contact = primaryContact(subcontractor);
              return (
                <li
                  key={subcontractor.id}
                  className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-3"
                  data-subcontractor-row
                >
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <Link
                        href={profileHref(subcontractor)}
                        className="min-w-0 break-words text-base font-medium underline-offset-2 hover:underline"
                      >
                        {subcontractor.trading_name}
                      </Link>
                      <StatusBadge archived={archived} />
                    </div>
                    <p className="break-words text-sm text-muted-foreground">
                      {areas || "No work area yet"}
                    </p>
                    {contact ? (
                      <div className="min-w-0 text-sm text-muted-foreground">
                        <p className="break-words">{contact.name}</p>
                        {contact.email ? <p className="break-words">{contact.email}</p> : null}
                        {contact.phone ? <p className="break-words">{contact.phone}</p> : null}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No contact yet</p>
                    )}
                    <SubcontractorActions
                      subcontractor={subcontractor}
                      archived={archived}
                      canEdit={canEdit}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
