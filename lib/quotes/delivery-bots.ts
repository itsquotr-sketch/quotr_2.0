const BOT_UA_PATTERN =
  /bot|crawler|spider|crawling|preview|prerender|headless|slackbot|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|discordbot|embedly|quora|pinterest|vkshare|skypeuripreview|googleimageproxy|yahoo|bingpreview|applebot|semrush|ahrefs|petalbot|bytespider|gptbot|claudebot|anthropic|curl|wget|python-requests|httpclient|office|outlook|proofpoint|mimecast|barracuda|messagelabs|safelinks|microsoft office/i;

export function isLikelyNonHumanUserAgent(
  userAgent: string | null | undefined
): boolean {
  const ua = userAgent?.trim();
  if (!ua) return true;
  return BOT_UA_PATTERN.test(ua);
}

export const QUOTE_PUBLIC_VIEW_BEACON_DELAY_MS = 1500;
