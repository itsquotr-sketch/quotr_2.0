import { redirect } from "next/navigation";

type CustomersRedirectProps = {
  searchParams: Promise<{ archived?: string }>;
};

/** Existing customer URLs stay valid. The directory now lives under Contacts. */
export default async function CustomersRedirectPage({
  searchParams,
}: CustomersRedirectProps) {
  const params = await searchParams;
  redirect(params.archived === "1" ? "/app/contacts?archived=1" : "/app/contacts");
}
