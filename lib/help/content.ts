/**
 * Public help articles.
 *
 * One source for the help pages and local search. A future helper can read
 * these articles directly. This module does not load project, company, or
 * billing data, and it does not call a model or a search service.
 */

export const HELP_SUPPORT_EMAIL = "hello@get-quotr.com";

export const HELP_GROUPS = [
  {
    id: "getting-started",
    label: "Getting started",
    slugs: ["getting-started", "your-first-job"],
  },
  {
    id: "estimating",
    label: "Estimating and quoting",
    slugs: [
      "estimate-pricing-and-quote",
      "rates-and-productivity",
      "missing-prices",
      "sending-a-quote",
      "variations-and-subcontractor-prices",
    ],
  },
  {
    id: "account",
    label: "Account and support",
    slugs: ["account-and-billing"],
  },
] as const;

export type HelpGroupId = (typeof HELP_GROUPS)[number]["id"];

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "list"; items: string[] }
  | { type: "links"; items: { href: string; label: string }[] }
  | { type: "details"; summary: string; paragraphs: string[] };

export type HelpSection = {
  heading: string;
  blocks: HelpBlock[];
};

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  group: HelpGroupId;
  keywords: string[];
  related: string[];
  sections: HelpSection[];
};

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    summary:
      "Confirm your email, then finish company setup: address, GST, and labour costs.",
    group: "getting-started",
    keywords: [
      "signup",
      "sign up",
      "confirmation",
      "resend",
      "company setup",
      "onboarding",
      "trading name",
      "address",
      "gst",
      "registered",
      "carpenter",
      "labourer",
      "benchmark",
      "margin",
    ],
    related: ["your-first-job", "rates-and-productivity", "account-and-billing"],
    sections: [
      {
        heading: "Confirm your email",
        blocks: [
          {
            type: "steps",
            items: [
              "Create the account. The next screen is Check your email.",
              "Open the confirmation link. That finishes creating the account and signs you in.",
              "If you were invited to a company, the link returns you to the invitation. Otherwise company setup starts.",
            ],
          },
          {
            type: "p",
            text: "The account cannot be used until the email is confirmed. If the link fails, use Resend confirmation email on that screen. Service email, including confirmation, is separate from product updates.",
          },
        ],
      },
      {
        heading: "Company setup",
        blocks: [
          {
            type: "p",
            text: "Setup is six steps: Your business, Business address, GST, Work you price, Labour costs, and Ready to price. Continue moves on. While it saves, the button shows Saving….",
          },
          {
            type: "list",
            items: [
              "Your business asks for the trading name clients normally see.",
              "Business address: search for the address or type it. Country comes from the previous step.",
              "Work you price: choose what you price most often. You can still use every supported work type later.",
              "Ready to price confirms the choices. Materials, labour, and productivity can be refined later under Rates.",
            ],
          },
        ],
      },
      {
        heading: "GST on your quotes",
        blocks: [
          {
            type: "p",
            text: "The GST step asks “Is your business registered for GST?” Choose Yes, registered or No, not registered.",
          },
          {
            type: "list",
            items: [
              "No, not registered: GST will not be added to client pricing.",
              "Yes, registered: the GST number can appear on client documents. For a New Zealand company, setup says quotes use the 15% GST rate. An Australian company is shown its own rate.",
              "An NZBN stored on the company does not decide GST registration.",
            ],
          },
          {
            type: "p",
            text: "GST on a quote is your GST treatment. It is separate from GST on a Quotr subscription. Subscription GST is covered in Account and billing.",
          },
        ],
      },
      {
        heading: "Carpenter and labourer costs",
        blocks: [
          {
            type: "p",
            text: "Labour costs asks what the hour costs the business. It is not the client charge-out rate. For Carpenter and for Labourer, choose Use my company cost or Use the Quotr benchmark.",
          },
          {
            type: "p",
            text: "The benchmarks shown here are $60 per person-hour for a carpenter and $35 per person-hour for a labourer. Each figure is an estimating labour cost. It is not the price the client pays. What those benchmarks do, and how margin differs from markup, is in Rates and productivity.",
          },
          {
            type: "p",
            text: "Default target gross margin % is separate. The screen says margin helps calculate selling prices and is not the hourly cost.",
          },
        ],
      },
      {
        heading: "Where to change this later",
        blocks: [
          {
            type: "list",
            items: [
              "Address: account menu, Company settings, then Address. The section is Address and region.",
              "GST: Company settings, then Tax. The GST rate is what Quotes and Variations calculate. The GST number is printed on documents and does not change that calculation. 0% is valid.",
              "Work types: Company settings, then Work types. Saving preferences does not change which work an estimate can include.",
              "Carpenter and labourer costs, and Company gross margin %: Rates. Company defaults says a change affects future estimates and regenerated estimates. An existing estimate does not change until it is regenerated.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "your-first-job",
    title: "Your first job",
    summary:
      "Name the job, describe the work, review Work and Details, then create the estimate.",
    group: "getting-started",
    keywords: [
      "new project",
      "first job",
      "job name",
      "description",
      "brief",
      "analyse job",
      "work areas",
      "details",
      "create estimate",
      "saving",
      "loading",
      "generating",
    ],
    related: ["getting-started", "estimate-pricing-and-quote", "missing-prices"],
    sections: [
      {
        heading: "Start the job",
        blocks: [
          {
            type: "steps",
            items: [
              "On the dashboard, choose Start your first job. Later jobs use New project.",
              "The dialog is Start a job. Enter a Job name. Add a customer only if you already know who it is for.",
              "Details come next. The name alone is not the description Quotr uses to find the work.",
            ],
          },
        ],
      },
      {
        heading: "Write a useful description",
        blocks: [
          {
            type: "p",
            text: "On Job details, describe the work in ordinary language: what is being built or replaced, the size, the main materials, and anything that changes the job such as access or height. The field’s example is “Replace existing 6 × 3m deck. About 1m high. Kwila decking. Access down side of house.”",
          },
          {
            type: "p",
            text: "Choose Analyse job. The button shows Analysing job… while that runs. Quotr does not visit the site. You still review what it understood.",
          },
        ],
      },
      {
        heading: "Review Work",
        blocks: [
          {
            type: "steps",
            items: [
              "Open Work and check the Work Areas. Remove any that are not part of this job, or add another Work Area.",
              "Mark scope as Include in scope or Not required where those choices are shown. Use Answer in details when a point still needs an answer.",
              "Choose Looks right — continue when the areas match the job. Saving shows Saving Work Areas….",
            ],
          },
        ],
      },
      {
        heading: "Answer Details",
        blocks: [
          {
            type: "p",
            text: "Details asks for the measurements and choices the estimate needs. Save each answer. You may see Saving answer…, Saving details…, or Finishing your details…. Could not save means that answer was not stored; use Try again.",
          },
          {
            type: "p",
            text: "Where you do not know an answer, Not sure — use Quotr assumption is offered on some questions. That records an assumption for you to review. It is not a promise that the assumption matches the site.",
          },
        ],
      },
      {
        heading: "Create the estimate",
        blocks: [
          {
            type: "p",
            text: "When the visible answers are complete, choose Create estimate. One control does this. It stays in place while a final save finishes.",
          },
          {
            type: "p",
            text: "You may then see Generating your estimate, Saving job details, Checking estimate readiness, Building your estimate…, or Creating your estimate…. The screen can also say this can take up to a minute. Those messages mean the job is being saved or calculated. They are not a finished client price.",
          },
          {
            type: "p",
            text: "Afterward, review quantities and assumptions before you rely on the figures. What Estimate, Pricing, and Quote are for is in the next guide.",
          },
        ],
      },
    ],
  },
  {
    slug: "estimate-pricing-and-quote",
    title: "Estimate, Pricing, and Quote",
    summary:
      "What each stage is for, and which changes need an updated estimate or pricing document.",
    group: "estimating",
    keywords: [
      "estimate",
      "pricing",
      "quote",
      "quantities",
      "assumptions",
      "stale",
      "update estimate",
      "recalculate",
      "continue to pricing",
      "reviewed",
    ],
    related: ["your-first-job", "missing-prices", "sending-a-quote", "rates-and-productivity"],
    sections: [
      {
        heading: "What each stage is for",
        blocks: [
          {
            type: "list",
            items: [
              "Estimate: quantities, hours, and costs from the job, your rates, and the assumptions still open. Review it before you rely on it.",
              "Pricing: the prices you intend to charge. Resolve anything still marked Pricing required, then mark the document reviewed.",
              "Quote: the client document, created from reviewed pricing. Sending it is a separate step.",
            ],
          },
          {
            type: "p",
            text: "Quotr does not visit the site, check the plans, or decide what you should charge. An estimate or quote is your document. The figures are not guaranteed to be accurate or complete for a particular job.",
          },
        ],
      },
      {
        heading: "Review quantities and assumptions",
        blocks: [
          {
            type: "p",
            text: "On the estimate, read Scope, Assumptions, and the quantities before Continue to Pricing. If a stated count and the measured quantities disagree, the stage shows Needs updating. Productivity that still needs a choice shows Review productivity.",
          },
          {
            type: "p",
            text: "Assumptions you accepted, including Not sure — use Quotr assumption, stay visible so you can change them. Changing them does not by itself rewrite a Pricing document or a Quote you have already created.",
          },
        ],
      },
      {
        heading: "When the estimate must be updated",
        blocks: [
          {
            type: "p",
            text: "If job details or company settings have changed since the estimate was built, the heading is Estimate needs updating. The explanation is: Update this estimate to apply the latest job details and company settings. Choose Update estimate. While it runs, the label is Updating estimate….",
          },
          {
            type: "p",
            text: "A rate or Company gross margin % change applies to future estimates and to estimates you regenerate. It does not rewrite an estimate, Pricing document, or Quote that is already saved. There is no automatic price update.",
          },
          {
            type: "p",
            text: "Pricing cannot be prepared from a stale estimate. The message is Regenerate the estimate before preparing final pricing. A quantity conflict blocks it as well.",
          },
        ],
      },
      {
        heading: "When pricing must be updated",
        blocks: [
          {
            type: "p",
            text: "After the estimate changes, an existing Pricing document can need to be brought up to date with the estimate. Until that is done, do not treat it as the source for a new Quote. The project can show Pricing needs to be brought up to date with the estimate.",
          },
          {
            type: "p",
            text: "Editing a line on pricing that was already reviewed returns that document to draft. The quote is not rewritten. A Quote that has been sent is a snapshot. How to correct one is in Sending a Quote.",
          },
          {
            type: "p",
            text: "Before a Quote exists, pricing has to be reviewed. The quote action says Mark pricing as reviewed before creating a quote. Lines that still need a price are covered in Missing prices and pricing review.",
          },
        ],
      },
    ],
  },
  {
    slug: "rates-and-productivity",
    title: "Rates and productivity",
    summary:
      "Company rates, Quotr benchmarks, labour cost versus client sell, and Deck productivity.",
    group: "estimating",
    keywords: [
      "rates",
      "benchmark",
      "carpenter",
      "labourer",
      "60",
      "35",
      "person-hour",
      "margin",
      "markup",
      "productivity",
      "deck",
      "calibration",
      "charge-out",
      "sell",
    ],
    related: ["getting-started", "missing-prices", "estimate-pricing-and-quote"],
    sections: [
      {
        heading: "Company rates and Quotr benchmarks",
        blocks: [
          {
            type: "p",
            text: "Rates opens on Your rate book: company rates you have set, Quotr benchmarks still in use, and rates that still need a price. A company rate is used instead of the benchmark for that item.",
          },
          {
            type: "p",
            text: "Under Company defaults, Use my rates where available means your saved rates take priority over benchmark allowances. Allow benchmark fallback rates means that when a rate is missing, Quotr can still estimate using a benchmark. If that fallback is off, a missing rate stays unpriced. It is then Pricing required, not a silent benchmark.",
          },
          {
            type: "p",
            text: "Choosing a benchmark for one task shows Future estimates will use the Quotr benchmark for this task. Saved estimates, Pricing documents, and Quotes stay as they are until you update them.",
          },
        ],
      },
      {
        heading: "Labour cost and client sell",
        blocks: [
          {
            type: "p",
            text: "The carpenter benchmark is $60 per person-hour. The labourer benchmark is $35 per person-hour. Both are estimating labour costs: what one person-hour costs the business. They are not client charge-out rates.",
          },
          {
            type: "p",
            text: "A company carpenter or labourer cost replaces that benchmark. The client charge is then worked out from the cost and Company gross margin %. On a labour line in Pricing, the cost field is Hourly cost and the client field is Hourly charge.",
          },
        ],
      },
      {
        heading: "Margin and markup",
        blocks: [
          {
            type: "p",
            text: "Gross margin is the share of the selling price that is not direct cost. Markup is the amount added on top of the cost, measured against the cost. They are different percentages for the same job. Quotr’s Default target gross margin % and Company gross margin % are margin, not markup.",
          },
          {
            type: "details",
            summary: "See a worked example",
            paragraphs: [
              "A $100 cost with a 20% gross margin becomes a $125 charge. The $25 difference is 20% of the $125 selling price.",
              "A 20% markup on that same $100 cost would be a $120 charge, because the $20 is added on top of the cost. Twenty percent margin is not twenty percent markup.",
              "If the cost is unknown, Quotr does not invent a margin. Pricing then shows Margin unavailable. That case is in Missing prices and pricing review.",
            ],
          },
        ],
      },
      {
        heading: "Productivity units",
        blocks: [
          {
            type: "p",
            text: "Labour productivity on Rates is hours required per unit. Lower values mean less labour time. The unit is on the row, for example hours per square metre or person-hours per hole. A productivity figure is time, not a dollar rate.",
          },
          {
            type: "p",
            text: "Changing a productivity rate affects future estimates. It does not rewrite an estimate you have already saved.",
          },
        ],
      },
      {
        heading: "Deck productivity review",
        blocks: [
          {
            type: "p",
            text: "Some deck estimates stop on Review Deck productivity before the figures are settled. The note says the stored calibrations stay on the organisation, and a choice here applies to this job only.",
          },
          {
            type: "list",
            items: [
              "Company calibration uses the hours already stored for the company.",
              "Quotr alternative uses the benchmark hours shown for that line.",
              "Use a different rate for this job takes the hours you type. It does not change the organisation rate.",
            ],
          },
          {
            type: "p",
            text: "Choose Use selections when every line has a choice. You then see Saving your choices… and Updating your estimate…. If the estimate or the company calibration changed while the review was open, review the lines again. The organisation rate was not changed.",
          },
        ],
      },
    ],
  },
  {
    slug: "missing-prices",
    title: "Missing prices and pricing review",
    summary:
      "What Pricing required means, where to enter a client price, and what blocks review.",
    group: "estimating",
    keywords: [
      "pricing required",
      "unknown cost",
      "cost unknown",
      "client price",
      "your price",
      "margin unavailable",
      "profitability",
      "mark as reviewed",
      "quote block",
    ],
    related: ["estimate-pricing-and-quote", "rates-and-productivity", "sending-a-quote"],
    sections: [
      {
        heading: "Pricing required",
        blocks: [
          {
            type: "p",
            text: "Pricing required means Quotr does not have a cost it can use for that line. The pricing page heading Pricing required says those lines still need a price, and to review them before creating the Quote.",
          },
          {
            type: "p",
            text: "A missing material, a specialist item, or a rate with no company figure and no benchmark can all land here. Your rate book counts them as Pricing Required. Adding a company rate does not fill in a Pricing document that already exists. Update the estimate, then bring pricing up to date, or enter the price on the line.",
          },
        ],
      },
      {
        heading: "Enter a client price",
        blocks: [
          {
            type: "p",
            text: "Where Quotr has not calculated a cost, the line says Enter your price for this work. Quotr has not calculated a cost or margin. The field is Your price.",
          },
          {
            type: "p",
            text: "Where a cost is known, the client fields are Unit charge or Hourly charge, and Total charge. Work Quotr can include but cannot calculate in detail uses You'll price this work yourself, and asks you to add the scope and your price in Pricing.",
          },
          {
            type: "p",
            text: "A client price records what you intend to charge. It does not look up a supplier, and it does not change other lines.",
          },
        ],
      },
      {
        heading: "Why margin may be unavailable",
        blocks: [
          {
            type: "p",
            text: "Margin is calculated from a known cost and the charge. If the cost is unknown, the line shows Cost unknown, Profitability unavailable, and Margin unavailable. Entering Your price does not invent that cost, so the margin stays unavailable.",
          },
          {
            type: "p",
            text: "Margin becomes available once both the cost and the charge are known. That percentage is gross margin, not markup. The difference is in Rates and productivity.",
          },
        ],
      },
      {
        heading: "Before pricing review or a Quote",
        blocks: [
          {
            type: "p",
            text: "These have to be cleared before Mark as reviewed, and before a Quote can be created:",
          },
          {
            type: "list",
            items: [
              "An estimate that still needs updating. Pricing says to regenerate the estimate first.",
              "Lines with no cost and no client price. The block is: Enter a client price for lines that still have no cost before creating a Quote.",
              "Work Quotr cannot calculate. The block is: Enter your price for work Quotr cannot calculate before creating a Quote.",
              "The Pricing reviewed checkbox: I have reviewed this pricing before creating a client quote. Then Mark as reviewed.",
            ],
          },
          {
            type: "p",
            text: "Reviewed pricing says: Reviewed. Create a quote when this pricing should go to the client. Further edits return the document to draft. The existing quote is not rewritten.",
          },
        ],
      },
    ],
  },
  {
    slug: "sending-a-quote",
    title: "Sending a Quote",
    summary:
      "Choose what the client sees, check Client preview, send, and revise without editing the copy you sent.",
    group: "estimating",
    keywords: [
      "send quote",
      "client preview",
      "presentation",
      "detailed",
      "grouped",
      "lump sum",
      "display",
      "accept",
      "revision",
      "resend",
    ],
    related: ["estimate-pricing-and-quote", "missing-prices", "variations-and-subcontractor-prices"],
    sections: [
      {
        heading: "Client presentation",
        blocks: [
          {
            type: "p",
            text: "On the Quote, Client presentation has three choices. Hidden lines stay on the quote. The choice does not change the quote total.",
          },
          {
            type: "list",
            items: [
              "Detailed: the client sees each visible line.",
              "Grouped: the client sees each Work Area with its stored total.",
              "Lump sum: the client sees the scope and the quote total.",
            ],
          },
        ],
      },
      {
        heading: "Client quote display",
        blocks: [
          {
            type: "p",
            text: "Client quote display chooses how much pricing detail the client sees. These choices change the client document only. The stored quote total stays the same, and hidden detail is not deleted.",
          },
          {
            type: "list",
            items: [
              "Description is always shown.",
              "Quantity, Unit, Unit price, and Line total can be shown or hidden.",
              "Unit is hidden when quantity is hidden.",
            ],
          },
          {
            type: "p",
            text: "Quote title, scope summary, and a valid-until date can be shown on the client document. Dates and scope are optional. A valid-until date does not block sending.",
          },
        ],
      },
      {
        heading: "Check Client preview",
        blocks: [
          {
            type: "steps",
            items: [
              "Choose Client preview and read the document the way the client will.",
              "Confirm the client name, site, scope, totals, and GST. Quote GST follows the company GST treatment. It is not the GST on your Quotr subscription.",
              "Return to the quote if something on a draft still needs a change. Saving client presentation… or Saving quote display… means that choice is still being stored.",
            ],
          },
        ],
      },
      {
        heading: "Send and acceptance",
        blocks: [
          {
            type: "p",
            text: "Send quote asks you to confirm. Sending emails a secure link to that exact revision. The quote snapshot will not change. Cancel closes the step without sending. The button shows Sending… while it goes.",
          },
          {
            type: "p",
            text: "The client can Accept quote or Decline from the link. You can also Mark accepted manually when you received acceptance another way. A quote that was already sent can still be accepted after a trial or subscription ends. Acceptance does not start a new charge to Quotr.",
          },
        ],
      },
      {
        heading: "Corrections and revisions",
        blocks: [
          {
            type: "p",
            text: "An issued quote is not edited in place. Client preview on that quote shows the document that was sent. To change the commercial content, use the pricing document, then:",
          },
          {
            type: "list",
            items: [
              "On a draft, Update from Pricing replaces that draft with a new snapshot from reviewed pricing.",
              "On a quote you have already sent, Create revision makes a new draft and does not change the quote the client has.",
              "Resend quote emails the same revision again. It does not change the snapshot.",
            ],
          },
          {
            type: "p",
            text: "There is no automatic update of a quote when rates or the estimate change. After the client has accepted, a later change of scope or price is a Variation, not an edit of the accepted quote.",
          },
        ],
      },
    ],
  },
  {
    slug: "variations-and-subcontractor-prices",
    title: "Variations and subcontractor prices",
    summary:
      "The short version of Variations, and of asking a subcontractor to price work.",
    group: "estimating",
    keywords: [
      "variation",
      "variations",
      "omission",
      "issue revision",
      "subcontractor",
      "requests",
      "price request",
      "rfq",
      "plan",
      "builder",
      "business",
    ],
    related: ["sending-a-quote", "missing-prices", "account-and-billing"],
    sections: [
      {
        heading: "Variations",
        blocks: [
          {
            type: "p",
            text: "Variations become available after the client accepts the quote. Before that, the project says Available after Quote acceptance. On a cancelled or completed project the message is that variations are not available.",
          },
          {
            type: "steps",
            items: [
              "Choose Create Variation when the agreed scope or price changes.",
              "Add the items and a price. Enter a price for every item before issuing. An omission says it will reduce the contract value.",
              "When the revision is ready, Issue revision. Once issued, its scope, pricing, and client attachments cannot be changed.",
              "Send to client emails that issued revision. The document says it changes the agreed scope and contract value only if accepted.",
            ],
          },
          {
            type: "p",
            text: "Variations are not a separate plan. Builder, Business, and the trial can open them after acceptance. They are not sold as an upgrade.",
          },
        ],
      },
      {
        heading: "Subcontractor prices",
        blocks: [
          {
            type: "p",
            text: "On the project, Requests is labelled Subcontractor prices. The page says: ask subcontractors to price work. Sending a request does not change the Quote or choose a supplier.",
          },
          {
            type: "steps",
            items: [
              "Add the business under Contacts if it is not there yet. Work areas on a contact help you find them. They are not rates.",
              "Create the request and choose Send request.",
              "If you use a reply, the confirmation is: use this response for draft pricing. It changes draft Pricing and does not award the work or notify the subcontractor.",
            ],
          },
          {
            type: "p",
            text: "Sending a request uses the same access as other new project work. When a trial or subscription has stopped new estimates and quotes, a new request stops as well. Reading requests you already sent is not a new plan. There is no extra subcontractor product to switch on.",
          },
        ],
      },
    ],
  },
  {
    slug: "account-and-billing",
    title: "Account and billing",
    summary:
      "Sign in, the trial and plans, the billing portal, and how to change product-update email.",
    group: "account",
    keywords: [
      "login",
      "sign in",
      "password",
      "reset",
      "logout",
      "log out",
      "sign out",
      "trial",
      "builder",
      "business",
      "billing",
      "cancel",
      "stripe",
      "gst",
      "product updates",
      "preferences",
    ],
    related: ["getting-started", "variations-and-subcontractor-prices"],
    sections: [
      {
        heading: "Sign in, password, and logout",
        blocks: [
          {
            type: "list",
            items: [
              "Sign in uses the email and password. The button is Sign in.",
              "Forgot password asks for the email. If an account exists for that email, Quotr sends password reset instructions. The next page is Set a new password. You do not need the old password. After Password updated, sign out and sign in with the new one.",
              "While signed in, Profile can Change password. That form asks for Current password and New password.",
              "The account menu says Log out. The phone menu says Sign out. Profile also says Sign out of Quotr on this device, and its button is Log out.",
            ],
          },
          {
            type: "links",
            items: [
              { href: "/login", label: "Sign in" },
              { href: "/forgot-password", label: "Forgot password" },
            ],
          },
        ],
      },
      {
        heading: "Trial and plans",
        blocks: [
          {
            type: "p",
            text: "A new organisation starts a 14-day trial. The trial does not ask for a card. Billing shows Quotr Trial and Business features · 1 user. Team members are available on Quotr Business. The trial is limited to one user.",
          },
          {
            type: "p",
            text: "When the trial ends, choose Quotr Builder or Business to continue creating and sending new work. Existing Projects, Estimates, Pricing, and Quotes stay available to view. A quote that was already sent can still be accepted.",
          },
          {
            type: "list",
            items: [
              "Quotr Builder is $65 a month, for one user, with estimating, quoting, company rates, and client quote send and acceptance.",
              "Quotr Business is $79 a month. The first user is included. Add further users from Team, up to five in total. An extra Business user is $35 a month.",
              "Those prices are excluding GST. Where New Zealand GST applies to the subscription, 15% is added on top. The amount you confirm at checkout is what you pay.",
            ],
          },
          {
            type: "p",
            text: "Subscription GST is not the GST on a customer quote. Quote GST is set under Company settings, Tax, and is explained in Getting started.",
          },
          {
            type: "p",
            text: "You can choose Builder or Business from Billing, and upgrade from Builder to Business. A change takes effect when billing confirms it. If an upgrade payment does not complete, you remain on Builder until billing confirms Business.",
          },
        ],
      },
      {
        heading: "Billing portal and cancellation",
        blocks: [
          {
            type: "p",
            text: "Manage billing opens the Stripe billing portal. Cancellation is done there. It stops the next renewal. It does not, by itself, refund the period already paid. A remedy the law requires is still available. A complaint about a charge can be sent to hello@get-quotr.com.",
          },
          {
            type: "p",
            text: "If a payment is past due, full access continues for seven days from when it became past due, and a billing warning is shown. New work stops at the end of those seven days unless the payment is resolved. If Quotr does not have that start time, the seven days are not given.",
          },
          {
            type: "p",
            text: "Cancelling does not delete projects, estimates, pricing, or quotes, and it does not close the account. There is no download of the whole account. To ask for the account to be closed, or for personal information to be deleted, email hello@get-quotr.com. That is separate from cancellation.",
          },
        ],
      },
      {
        heading: "Product updates",
        blocks: [
          {
            type: "p",
            text: "At signup you can answer whether you want occasional product updates and practical Quotr tips. Yes or no both let you create the account. There is no product-update control in Profile, Company settings, or Billing.",
          },
          {
            type: "p",
            text: "To change or withdraw that choice, email hello@get-quotr.com. Quotr does not currently send those updates from a marketing email tool. Account, security, and service emails, including confirmation and password reset, are still sent either way.",
          },
          {
            type: "links",
            items: [
              {
                href: "mailto:hello@get-quotr.com",
                label: "Email hello@get-quotr.com",
              },
            ],
          },
        ],
      },
    ],
  },
];

const articlesBySlug = new Map(HELP_ARTICLES.map((article) => [article.slug, article]));

export function getHelpArticle(slug: string): HelpArticle | null {
  return articlesBySlug.get(slug) ?? null;
}

export function helpArticlesInGroup(groupId: HelpGroupId): HelpArticle[] {
  const group = HELP_GROUPS.find((item) => item.id === groupId);
  if (!group) return [];
  return group.slugs.map((slug) => {
    const article = articlesBySlug.get(slug);
    if (!article) {
      throw new Error(`Help group ${groupId} is missing ${slug}.`);
    }
    return article;
  });
}

function blockText(block: HelpBlock): string {
  switch (block.type) {
    case "p":
      return block.text;
    case "steps":
    case "list":
      return block.items.join(" ");
    case "links":
      return block.items.map((item) => item.label).join(" ");
    case "details":
      return `${block.summary} ${block.paragraphs.join(" ")}`;
  }
}

/** Visible words for a future helper. Keywords are for search, not this text. */
export function helpArticlePlainText(article: HelpArticle): string {
  const parts = [article.title, article.summary];
  for (const section of article.sections) {
    parts.push(section.heading);
    for (const block of section.blocks) parts.push(blockText(block));
  }
  return parts.join("\n");
}
