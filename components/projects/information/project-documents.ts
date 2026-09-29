/**
 * Project Documents belong inside Project Information.
 *
 * UX-01F.2 will add the Document Centre on this route.
 * This phase does not upload files, create a storage bucket, copy Variation
 * attachments, or expose storage paths. Variation attachment rows are not
 * loaded here, so there is no Variation files summary yet.
 */
export const PROJECT_DOCUMENT_OWNERSHIP = "project-information" as const;
