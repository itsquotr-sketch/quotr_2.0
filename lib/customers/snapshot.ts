/**
 * Fields copied onto a project when a customer is chosen.
 * The directory record is not updated, and later directory edits do not
 * flow back into the project.
 */
export function projectSnapshotFromCustomer(customer: {
  name: string;
  email: string | null;
}): { client_name: string; client_email: string | null } {
  return {
    client_name: customer.name,
    client_email: customer.email,
  };
}
