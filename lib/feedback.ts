type FeedbackMailtoInput = {
  pageUrl: string;
  userEmail?: string | null;
  projectId?: string | null;
};

export function extractProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/app\/projects\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export function buildFeedbackMailtoHref(input: FeedbackMailtoInput | string): string {
  const { pageUrl, userEmail, projectId } =
    typeof input === "string"
      ? { pageUrl: input, userEmail: undefined, projectId: undefined }
      : input;

  const email = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim();
  const subject = encodeURIComponent("Quotr beta feedback");
  const lines = [`Page: ${pageUrl}`];

  if (userEmail?.trim()) {
    lines.push(`User: ${userEmail.trim()}`);
  }

  if (projectId?.trim()) {
    lines.push(`Project ID: ${projectId.trim()}`);
  }

  lines.push("", "Describe the issue or feedback:", "");

  const body = encodeURIComponent(lines.join("\n"));

  if (email) {
    return `mailto:${email}?subject=${subject}&body=${body}`;
  }

  return `mailto:?subject=${subject}&body=${body}`;
}
