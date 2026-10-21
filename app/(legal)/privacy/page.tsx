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
          {TERMS_OF_USE_VERSION}. It is a draft and is not yet in force. It is
          separate from the website privacy notice at get-quotr.com, which
          covers the public website and not an account.
        </p>
        <p>
          The supplier’s registered name, address, and monitored privacy
          contact are not stated here. They will be inserted only after the
          owner confirms them. This draft does not treat a name or email on the
          public website as that contact.
        </p>
        <p>
          The notice is written for the New Zealand Privacy Act 2020. Storing
          an Australian phone number or an ABN, if a user types one, does not
          by itself mean the Australian Privacy Act 1988 applies. Whether that
          Act applies depends on the supplier’s link with Australia, including
          whether the supplier carries on business there. That has not been
          established from the application’s records. This draft does not offer
          the Australian privacy complaints process as if that Act already
          covered Quotr.
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
          <li>Billing references for a subscription, such as the Stripe customer and the plan status. Card numbers are entered in Stripe, not stored as card numbers in Quotr.</li>
          <li>Technical logs used to run and protect the service, such as sign-in events and email delivery status.</li>
        </ul>
      </LegalSection>

      <LegalSection id="why" title="3. Why it is collected, and what is required">
        <p>
          This information is used to create the account, provide estimating
          and quoting, send the messages you ask the application to send, bill
          for a paid plan, and keep the service secure.
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
          quote or estimate cannot be completed or sent. The product-update
          choice is separate. An account can be created whether the answer is
          yes or no.
        </p>
        <p>
          Where information is collected from you, the screen states the
          purpose. Where you enter someone else’s details, you need a proper
          reason to do that. Section 8 explains what those people are told.
        </p>
      </LegalSection>

      <LegalSection id="providers" title="4. Providers and where information is processed">
        <p>
          The Production application is configured as follows. This notice does
          not say that information stays in New Zealand.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Supabase stores the Production account, organisation, and job
            database, and uploaded files, in region ap-northeast-1 (Tokyo).
            The separate Preview database is in ap-southeast-2 (Sydney). Preview
            is not the Production store.
          </li>
          <li>
            Vercel hosts the application. Its configured function region is
            iad1 (Washington, D.C., United States).
          </li>
          <li>
            Stripe takes payment, issues invoices, and can apply the configured
            New Zealand GST rate on subscription fees. A Stripe data-residency
            region is not set in the application.
          </li>
          <li>
            Resend sends account, security, team, and quote email. A Resend
            storage region is not set in the application.
          </li>
          <li>
            Google returns address suggestions when address search is used. The
            typed query is sent for that search. You can type an address
            instead. A Google storage region is not set in the application.
          </li>
          <li>
            Anthropic receives the text described in section 5. The call uses
            Anthropic’s commercial API. A processing region is not selected in
            the application.
          </li>
        </ul>
        <p>
          Loops is not described as a current processor. Production is not
          configured with a Loops credential, and the application code does not
          call Loops. The account stores a product-update choice and a flag
          that a sync is pending. That flag does not send a campaign.
        </p>
        <p>
          Under the New Zealand Privacy Act 2020, a disclosure outside New
          Zealand needs a permitted ground. The known Production stores are
          Tokyo and the United States, as listed above. Comparable safeguards
          for each provider, including each provider’s data-processing terms,
          still have to be recorded against that ground before this notice is
          used. They are not attached to this draft.
        </p>
      </LegalSection>

      <LegalSection id="ai" title="5. Analysis and assistant features">
        <p>
          If you run an analysis or assistant feature, the text that feature
          needs is sent to Anthropic’s commercial API so it can return a
          result. The current request path sends text. This notice does not say
          that stored photos are sent to the model.
        </p>
        <p>
          Anthropic’s Commercial Terms say Anthropic may not train models on
          customer content submitted to the services. Anthropic’s commercial
          privacy statement says that, by default, inputs and outputs from the
          API are not used to train models. Quotr does not send a feedback
          rating to Anthropic, and the application has no setting that opts
          into Anthropic’s Development Partner Program. That program is a
          separate, express opt-in and, as Anthropic describes it, applies to
          Claude Code sessions rather than to ordinary API calls. This
          account’s console privacy screen was not readable from the
          application. Nothing in the application code or its environment
          variables opts into training.
        </p>
        <p>
          Anthropic’s published commercial retention statement says API inputs
          and outputs are deleted from Anthropic’s backend within 30 days,
          unless a different arrangement applies, the content is needed to
          enforce Anthropic’s usage policy, or the law requires longer
          retention. Flagged usage-policy content may be kept longer under
          Anthropic’s statement. Quotr has no zero-data-retention setting in
          the application. This notice does not claim that arrangement.
        </p>
      </LegalSection>

      <LegalSection id="messages" title="6. Product updates and service email">
        <p>
          At signup you are asked whether you want occasional product updates
          and practical tips. Yes is stored as consent. No is stored as no
          consent. The choice is stored with the source “signup”, and the
          account is marked so the preference can be synced later. That mark
          does not start a campaign. There is no production mail tool connected
          to that flag today.
        </p>
        <p>
          You can change the choice where the application offers that setting.
          Once a monitored contact is published, you will also be able to use
          it to withdraw the choice. Service email is separate. The application
          still sends account, security, and service messages, including
          confirmation and password reset, whether or not you want product
          updates.
        </p>
      </LegalSection>

      <LegalSection id="security" title="7. Security, access, correction, and retention">
        <p>
          Access to an organisation’s information is limited to signed-in
          members of that organisation and to the providers in section 4 for
          the purposes in this notice. No online service can promise that
          information will never be accessed without permission. If a breach is
          likely to cause serious harm, the people affected and the New Zealand
          Privacy Commissioner will be notified as the Privacy Act 2020
          requires.
        </p>
        <p>
          There is no button that downloads the whole account. While you can
          open the application, you can view the projects, estimates, pricing,
          and quotes it shows, and you can use the print and send actions those
          screens still allow. After a trial ends, or after a cancelled,
          unpaid, or paused subscription passes its service end, creating new
          estimating or quoting work is blocked. Accepting a quote that was
          already sent can still be completed. Records are not deleted by that
          change, and view access is not switched off after a fixed number of
          days. A 90-day figure in the billing code is not applied.
        </p>
        <p>
          Proposed, not yet approved: view access to job content would continue
          for 90 days after the service end and would then stop. Billing and
          tax records of the subscription would be kept for seven years. Job
          notes, photos, quotes, and customer details would not be kept for
          that seven-year period. This is not an automatic deletion deadline
          today. Approving it means the cutoff has to be built later. Until it
          is built, the previous paragraph is what happens.
        </p>
        <p>
          You can ask, once a monitored contact is published, to confirm
          whether personal information is held, to receive a copy of it, and to
          correct information that is inaccurate or misleading. New Zealand
          privacy law does not give a general right to deletion. A request to
          delete will be actioned when the information is no longer needed or
          when the law requires deletion. The response will be within the time
          the Privacy Act requires.
        </p>
        <p>
          If you are not satisfied with the response, you can complain to the
          Office of the Privacy Commissioner at privacy.org.nz.
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
          signature. This notice is how the application explains its own
          handling. Your organisation is responsible for telling those people
          why it holds their details and for having a proper reason to pass
          them to Quotr.
        </p>
        <p>
          A recipient will be able to write to the monitored contact, once it
          is published, about information held because a customer sent them a
          quote or invitation. Correcting a job record may require that
          customer, because the record is kept in the customer’s account.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
