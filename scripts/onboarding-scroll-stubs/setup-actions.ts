export async function saveRequiredCompanyProfile(input: {
  trading_name?: string;
  tax_identifier?: string;
  gst_registered?: string;
}) {
  if (input.gst_registered === "yes" && input.tax_identifier !== "123456789") {
    return { fieldErrors: { tax_identifier: ["Enter a GST number"] } };
  }
  return {};
}
