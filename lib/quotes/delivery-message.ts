export function defaultQuoteDeliveryMessage(input: {
  clientName?: string | null;
  projectTitle?: string | null;
}): string {
  const client = input.clientName?.trim() || "there";
  const project = input.projectTitle?.trim() || "your project";
  return `Hi ${client}, please find our quote for ${project}. You can view the full quote using the secure link below.`;
}
