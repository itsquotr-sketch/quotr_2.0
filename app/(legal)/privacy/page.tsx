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
      <LegalSection id="about" title="1. Who this notice is from">
        <p>
          This notice explains how the Quotr application handles personal
          information. It accompanies Application Terms version{" "}
          {TERMS_OF_USE_VERSION}. It is separate from the website privacy
          notice at get-quotr.com, which covers the public website and not an
          account.
        </p>
        <p>
          The application is supplied by Flowra Limited, trading as Quotr.
          NZBN 9429052916465. Public location: Auckland, New Zealand. Flowra
          Limited collects the account and job information described below and
          holds it for the Quotr application. Privacy, access, correction, and
          deletion requests, and complaints, go to hello@get-quotr.com.
        </p>
        <p>
          This notice is written for the New Zealand Privacy Act 2020. The{" "}
          <Link href={TERMS_OF_USE_URL} className="underline underline-offset-4">
            Application Terms
          </Link>{" "}
          explain the service.
        </p>
      </LegalSection>

      <LegalSection id="what" title="2. Information the application holds">
        <p>Depending on what you do in Quotr, we hold:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account details: name, email, and phone number.</li>
          <li>
            A password, which is handled by Supabase Auth. We do not keep a
            readable copy of the password in company or job records. Supabase
            Auth keeps it in a protected form used to check later sign-ins.
          </li>
          <li>Organisation details: company name, address, logo, NZBN, GST number or ABN, and GST choice.</li>
          <li>Team details: names and emails of people you invite, and their role.</li>
          <li>Customer and supplier contacts you enter, including names, emails, phone numbers, and addresses.</li>
          <li>Job notes, measurements, photos and files, estimates, rates, pricing, quotes, and variations.</li>
          <li>Quote acceptance, including a typed or drawn signature and the time it was given.</li>
          <li>Billing references for a subscription, such as the Stripe customer and the plan. Card numbers are entered in Stripe. We do not store the card number.</li>
          <li>Technical logs used to run and protect the service, such as sign-in events and email delivery status.</li>
        </ul>
      </LegalSection>

      <LegalSection id="why" title="3. Why it is collected, and what is required">
        <p>
          We use this information to create and protect the account, provide
          estimating and quoting, send messages you ask us to send, bill for a
          paid plan, and meet legal duties.
        </p>
        <p>
          A name, email, password, phone number, and organisation name are
          required to create an account. Without them, the account is not
          created. You must confirm the email before the account can be used.
          The phone number is not used to sign in and is not texted. Nothing
          in account creation is required by a statute. You choose whether to
          open an account.
        </p>
        <p>
          Job details, prices, and customer contacts are needed only for the
          quote or estimate you choose to prepare. If you leave them out, that
          quote or estimate cannot be completed or sent. The product-update
          question is separate. You can create an account whether you answer
          yes or no.
        </p>
        <p>
          You can ask us whether we hold personal information about you, ask
          for a copy, and ask us to correct information that is inaccurate or
          misleading. Those requests go to hello@get-quotr.com.
        </p>
      </LegalSection>

      <LegalSection id="providers" title="4. Who else handles information">
        <p>
          Production information is not stored only in New Zealand. The
          companies below handle it so the application can run. Some act only
          to do work for us. Others also use information for their own service.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Supabase stores the Production database and uploaded files in
            Tokyo, and provides sign-in. It does that for us.
          </li>
          <li>
            Vercel hosts the application from the United States. It does that
            for us.
          </li>
          <li>
            Resend sends account, security, team, and quote email for us.
          </li>
          <li>
            Stripe takes payment, issues invoices, and applies New Zealand GST
            on our subscription fees. Stripe handles card details for that
            payment service, including Stripe’s own payment duties.
          </li>
          <li>
            Google returns address suggestions when you search for an address.
            The words you type are sent to Google for that search. Google
            provides that search as its own service. You can type an address
            instead.
          </li>
          <li>
            Anthropic receives the text described in section 5, when you use an
            analysis or assistant feature, and returns a result. That call uses
            Anthropic’s commercial API.
          </li>
        </ul>
        <p>
          A person you invite can see the organisation according to the role
          you give them. A customer, supplier, or other recipient can open a
          quote, variation, price request, or invitation when you send them the
          link for it. They do not become a member of the account.
        </p>
      </LegalSection>

      <LegalSection id="ai" title="5. Analysis and assistant features">
        <p>
          If you run an analysis or assistant feature, the text that feature
          needs is sent to Anthropic so it can return a result. Stored photos
          are kept with the job. This notice does not say those photos are sent
          to Anthropic.
        </p>
        <p>
          Anthropic’s commercial terms say Anthropic may not train its models
          on customer content submitted to that API. Anthropic’s commercial
          privacy statement says that, by default, API inputs and outputs are
          not used for model training. Anthropic also says it deletes ordinary
          API inputs and outputs within 30 days, unless the law, a safety
          review, or a different arrangement requires longer retention. We have
          not arranged a shorter retention period with Anthropic.
        </p>
      </LegalSection>

      <LegalSection id="messages" title="6. Product updates and service email">
        <p>
          At signup you choose whether you want occasional product updates and
          practical tips. Yes is stored as consent. No is stored as no consent.
          Either choice lets you create the account. We do not currently send
          those product updates from a marketing email tool.
        </p>
        <p>
          To change or withdraw that choice, email hello@get-quotr.com. We will
          record the change. Account, security, and service emails are
          separate. We still send those, including confirmation and password
          reset, whether or not you want product updates.
        </p>
      </LegalSection>

      <LegalSection id="security" title="7. Security, retention, access, and correction">
        <p>
          We limit access to what is needed to provide the service, including
          the people and companies in section 4. No online service can promise
          that information will never be accessed without permission. If a
          breach is likely to cause serious harm, we will notify the people
          affected and the Privacy Commissioner as the Privacy Act 2020
          requires.
        </p>
        <p>
          We keep information while the account is open and while it is still
          needed for the service, for billing, for a dispute, for security, or
          for a legal duty. Cancelling a subscription does not close the
          account and does not delete job information. After the service end
          described in the Application Terms, existing work remains available
          to view. There is no download of the whole account, and there is no
          automatic deletion.
        </p>
        <p>
          To ask for a copy, a correction, closure of the account, or deletion,
          email hello@get-quotr.com. Include your name, the account email, and
          what you are asking for. We may need to check that the request is
          from you. New Zealand privacy law does not give a general right to
          deletion. We will delete information when we no longer need it for a
          purpose in this notice, or when the law requires deletion.
          Subscription and tax records may be kept for the period New Zealand
          tax law requires. Job notes, photos, quotes, and customer details are
          not kept just to meet that tax period. We will respond within the
          time the Privacy Act requires.
        </p>
        <p>
          If you are not satisfied, you can complain to us at
          hello@get-quotr.com, and you can complain to the Office of the
          Privacy Commissioner at privacy.org.nz.
        </p>
      </LegalSection>

      <LegalSection id="others" title="8. People whose details you enter">
        <p>
          When you enter a customer, supplier, or teammate, we receive their
          details from you rather than from them. We still have to handle that
          information lawfully. Your duty to have a proper reason for entering
          it, and to tell them why you hold it, sits alongside our duties. It
          does not replace them.
        </p>
        <p>
          A quote, variation, price request, or invitation identifies your
          organisation as the sender. We host the message and the page opened
          from its link. A recipient can email hello@get-quotr.com about
          information we hold because that message was sent. Correcting a job
          record may also need the account holder, because the record is part
          of that account.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
