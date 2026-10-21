import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal/LegalDocument";
import { TERMS_OF_USE_URL, TERMS_OF_USE_VERSION } from "@/lib/auth/signup-choices";

export const metadata: Metadata = {
  title: "Privacy Notice | Quotr",
  robots: { index: false, follow: false },
};

export default function ApplicationPrivacyPage() {
  return (
    <LegalDocument kicker="Quotr application" title="Privacy Notice">
      <LegalSection id="about" title="1. Who this notice covers">
        <p>
          This notice explains how the Quotr application handles personal
          information. It accompanies Application Terms version{" "}
          {TERMS_OF_USE_VERSION}. It is separate from the website privacy
          notice at get-quotr.com, which covers the public website and not an
          account.
        </p>
        <p>
          The registered name and address of the organisation responsible for
          this information will be published in this section before the notice
          is used for Production accounts. Privacy requests can be sent now to
          privacy@quotr.co.nz, which is the address already published for Quotr
          privacy contact. Please include your name, the email on the account,
          and what you are asking for. We may need to check that the request
          comes from you.
        </p>
        <p>
          The{" "}
          <Link href={TERMS_OF_USE_URL} className="underline underline-offset-4">
            Application Terms
          </Link>{" "}
          explain the service those accounts use.
        </p>
      </LegalSection>

      <LegalSection id="what" title="2. Information the application holds">
        <p>Depending on what you do in Quotr, the application holds:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account details: name, email, phone number, and password credentials.</li>
          <li>Organisation details: company name, address, logo, NZBN, GST number or ABN, and GST choice.</li>
          <li>Team details: names and emails of people you invite, and their role.</li>
          <li>Customer and supplier contacts you enter, including names, emails, phone numbers, and addresses.</li>
          <li>Job notes, measurements, photos and files, estimates, rates, pricing, quotes, and variations.</li>
          <li>Quote acceptance, including a typed or drawn signature and the time it was given.</li>
          <li>Billing references held for the subscription, such as the Stripe customer and the plan status. Card numbers are entered in Stripe, not stored as card numbers in Quotr.</li>
          <li>Technical logs needed to run and protect the service, such as sign-in events and email delivery status.</li>
        </ul>
      </LegalSection>

      <LegalSection id="why" title="3. Why it is collected, and what is required">
        <p>
          We collect this information to create the account, provide estimating
          and quoting, send the messages you ask us to send, bill for a paid
          plan, keep the service secure, and meet record-keeping duties.
        </p>
        <p>
          A name, email, password, phone number, and organisation name are
          required to create an account. Without them, the account is not
          created. Email confirmation is required before the account can be
          used. The phone number is not used to sign in and is not texted.
        </p>
        <p>
          Job details, prices, and customer contacts are required only for the
          quote or estimate you choose to prepare. If you leave them out, that
          quote or estimate cannot be completed or sent. Marketing preference
          is a separate choice. You can create an account whether you say yes
          or no to product updates.
        </p>
        <p>
          Where we collect information from you, we try to make the purpose
          clear on the screen. Where you enter someone else’s details, you need
          a proper reason to do that, and section 8 explains what those people
          are told.
        </p>
      </LegalSection>

      <LegalSection id="providers" title="4. Service providers and overseas processing">
        <p>
          Quotr uses service providers to run the application. Information may
          be processed outside New Zealand. We have not published a
          country-by-country storage map, and this notice does not claim that
          information stays in New Zealand.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Supabase stores the account, organisation, and job database, and uploaded files.</li>
          <li>Vercel hosts the application.</li>
          <li>Stripe takes payment, issues invoices, and applies GST on our subscription fees.</li>
          <li>Resend sends account, security, team, and quote email.</li>
          <li>Google provides address suggestions when you use address search. You can type an address instead.</li>
          <li>Anthropic receives text when you use an analysis or assistant feature, as section 5 describes.</li>
          <li>Loops is the marketing email tool for product updates if you opt in and a sync is run.</li>
        </ul>
        <p>
          We disclose information overseas when we believe the recipient is
          subject to safeguards comparable to the New Zealand Privacy Act 2020,
          or another ground in that Act allows the disclosure. A provider list
          with countries and the safeguard relied on will be added before this
          notice is used in Production.
        </p>
      </LegalSection>

      <LegalSection id="ai" title="5. Analysis and assistant features">
        <p>
          If you run an analysis or assistant feature, the text that feature
          needs is sent to Anthropic so it can return a result. The application
          uses Anthropic’s Claude models for that request. Photos and files are
          stored for the job. This notice does not say they are sent to the
          model, because the current request path sends text.
        </p>
        <p>
          We do not state in this notice that Anthropic never uses that text to
          train models. The application does not contain an agreement we can
          quote for that promise. Any such statement will be added only when
          the arrangement is confirmed.
        </p>
      </LegalSection>

      <LegalSection id="messages" title="6. Product updates and service email">
        <p>
          At signup you are asked whether you want occasional product updates
          and practical Quotr tips. Yes is stored as consent. No is stored as no
          consent. The choice is recorded with the source “signup”, and the
          account is marked so the marketing preference can be synced. That
          mark does not itself start a campaign.
        </p>
        <p>
          You can change the choice later where the application offers that
          setting. You can also email privacy@quotr.co.nz and ask to stop
          product updates. Service email is separate. We still send account,
          security, and service messages, including confirmation and password
          reset, whether or not you want product updates.
        </p>
      </LegalSection>

      <LegalSection id="security" title="7. Security, retention, access, and correction">
        <p>
          Access to an organisation’s information is limited to signed-in
          members of that organisation, and to the providers above for the
          purposes in this notice. Passwords are handled by the authentication
          service. No online service can promise that information will never be
          accessed without permission. If a breach is likely to cause serious
          harm, we will notify the people affected and the Privacy Commissioner
          as the Privacy Act 2020 requires.
        </p>
        <p>
          We keep information while the account is open, while view access
          remains after a trial or cancellation, and for as long as we need it
          for billing, disputes, security, or a legal duty. This notice does
          not set a fixed number of months or years for deletion after an
          account closes. We will publish that period before this notice is
          used in Production, rather than invent one.
        </p>
        <p>
          You can ask us to confirm whether we hold personal information about
          you, to provide a copy, and to correct information that is inaccurate,
          incomplete, or misleading. New Zealand privacy law does not give a
          general right to deletion. We will delete information when we no
          longer need it, or when the law requires deletion. Write to
          privacy@quotr.co.nz. We will respond within the time the law requires.
        </p>
        <p>
          If you are not satisfied, you can complain to the Office of the
          Privacy Commissioner at privacy.org.nz. If the supplier is required
          to comply with the Australian Privacy Act, an Australian user can
          also complain to the Office of the Australian Information
          Commissioner. Whether that Act applies to this supplier is not
          confirmed in this draft.
        </p>
      </LegalSection>

      <LegalSection id="others" title="8. People whose details you enter">
        <p>
          Customers, suppliers, and invited teammates do not open your account.
          You enter their details, or they receive a quote, variation, or
          invitation that you send.
        </p>
        <p>
          The message identifies your organisation as the sender. Quotr hosts
          the message and, for a quote or variation, the page where the
          recipient can read it and, where you ask for it, accept it with a
          signature. This notice is how Quotr explains its own handling. Your
          organisation is responsible for telling those people why it holds
          their details and for having a proper reason to pass them to Quotr.
        </p>
        <p>
          A recipient can email privacy@quotr.co.nz about information Quotr
          holds because a customer sent them a quote or invitation. We may need
          to involve that customer to correct a job record, because the record
          belongs to the customer’s account.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
