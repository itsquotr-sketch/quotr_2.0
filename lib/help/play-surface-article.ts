import type { HelpArticle } from "@/lib/help/content";
import { PLAY_SURFACE_BILLING_NOTE } from "@/lib/android/play-surface";

/**
 * The public help article stays the website article.
 * The Play host replaces the sections that tell a person to pay in Stripe.
 */
export function helpArticleForPlaySurface(article: HelpArticle): HelpArticle {
  if (article.slug !== "account-and-billing") return article;
  return {
    ...article,
    summary:
      "Create a free account, sign in, the current trial or subscription, and product-update email.",
    keywords: article.keywords.filter((keyword) => keyword !== "stripe"),
    sections: article.sections.flatMap((section) => {
      if (section.heading === "Billing portal and cancellation") return [];
      if (section.heading !== "Trial and plans") return [section];
      return [
        {
          heading: "Subscription",
          blocks: [
            {
              type: "p" as const,
              text: "Create a free account, or sign in with an account that already exists. A new organisation uses the existing 14-day Business trial. The trial does not ask for a card, and the app does not take payment.",
            },
            { type: "p" as const, text: PLAY_SURFACE_BILLING_NOTE },
            {
              type: "p" as const,
              text: "Billing shows the trial and its end date, an active subscription, a scheduled cancellation and its service end, or read-only access after a trial or subscription ends. Refresh account status re-reads the subscription. A return link does not grant access.",
            },
            {
              type: "p" as const,
              text: "When a trial ends, or a subscription stops, existing Projects, Estimates, Pricing, and Quotes stay available to view. Creating and sending new work follows the same subscription rules as the website.",
            },
            {
              type: "p" as const,
              text: "Stopping a subscription does not delete projects, estimates, pricing, or quotes, and it does not close the account. To ask for the account to be closed, or for personal information to be deleted, open [Request account deletion](/account-deletion) or email [hello@get-quotr.com](mailto:hello@get-quotr.com). That request does not delete the account.",
            },
          ],
        },
      ];
    }),
  };
}
