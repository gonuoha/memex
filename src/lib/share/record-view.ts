const UNFURLER_PATTERN =
  /Slackbot|Twitterbot|facebookexternalhit|Discordbot|LinkedInBot|WhatsApp|TelegramBot|Googlebot|bingbot/i;

export function shouldRecordShareLinkView(
  method: string,
  userAgent: string | null,
): boolean {
  if (method.toUpperCase() === "HEAD") {
    return false;
  }

  if (!userAgent) {
    return true;
  }

  return !UNFURLER_PATTERN.test(userAgent);
}
