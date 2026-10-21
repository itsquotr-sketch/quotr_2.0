import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal/LegalDocument";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_VERSION } from "@/lib/auth/signup-choices";

export const metadata: Metadata = {
  title: "Application Terms | Quotr",
  robots: { index: false, follow: false },
};

export default function ApplicationTermsPage() {
  return (
    <LegalDocument kicker="Quotr application" title="Application Terms">
      <LegalSection id="about" title="1. About these terms">
        <p>
          These Application Terms are version {TERMS_OF_USE_VERSION}. They are
          a draft for the Quotr application. They are not yet in force. They
          are separate from the website terms at get-quotr.com, which govern
          only the public website.
        </p>
        <p>
          The supplier’s registered name, address, and monitored contact are
          not stated here. They will be inserted only after the owner confirms
          them. Until then, do not treat any name or email on the public
          website as the contracting party for these terms.
        </p>
        <p>
          “You” means the person who creates the account and the organisation
          that person acts for. “We” and “us” mean the supplier of the
          application. Privacy is described in the{" "}
          <Link href={PRIVACY_POLICY_URL} className="underline underline-offset-4">
            Privacy Notice
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="account" title="2. Accounts, authority, and team access">
        <p>
          To create an account you give your name, work email, phone number,
          and a password, and you name the organisation. You confirm the email
          address before the account can be used. The phone number is stored
          with the account. It is not used to sign in, and the application does
          not text it.
        </p>
        <p>
          You confirm that you are allowed to open the account for that
          organisation and to bind it to these terms. If you are not, do not
          create the account.
        </p>
        <p>
          You can invite other people into the organisation. They receive the
          access that goes with the role you give them. You are responsible for
          who you invite and for removing someone who should no longer have
          access. The trial includes Business features for one user. A paid
          Builder plan is one user. A paid Business plan includes one user and
          can add further users up to five in total. A custom arrangement, if
          one is agreed, is set outside self-serve checkout.
        </p>
      </LegalSection>

      <LegalSection id="service" title="3. The estimating and quoting service">
        <p>
          Quotr provides tools to record a job, calculate an estimate, set
          prices, and prepare a quote or variation. Some calculations use your
          rates, your calibrations, or Quotr benchmarks. You choose whether
          benchmarks are used. Where you have entered a company rate, that rate
          is used instead of the benchmark.
        </p>
        <p>
          Outputs depend on what you enter and on the assumptions still open in
          the job. Quotr does not visit the site, check the plans, or decide
          what you should charge. You review quantities, assumptions,
          benchmarks, and prices before you rely on them or send them to a
          customer. An estimate or quote is your document. It is not our
          advice, and it is not a promise that the job will cost that amount.
        </p>
        <p>
          GST on a quote you send is your GST treatment. It is separate from
          GST on a subscription you pay us. If you tell Quotr you are not GST
          registered, quote GST is not added from that choice. An NZBN stored
          on the organisation is not used to decide GST registration.
        </p>
      </LegalSection>

      <LegalSection id="plans" title="4. Trial, plans, and GST on our fees">
        <p>
          A new organisation starts a 14-day trial. The trial does not ask for
          a card. During the trial the organisation has Business features for
          one user. When the trial ends, new estimating and quoting work is
          blocked. Records already in the account are not deleted by that
          change.
        </p>
        <p>
          Paid plans are offered monthly in New Zealand dollars through Stripe.
          The application shows Quotr Builder at $65 a month, Quotr Business at
          $79 a month, and an extra Business user at $35 a month. Those amounts
          are exclusive of GST. Where a New Zealand GST tax rate is configured
          on the subscription, GST of 15% is added on top. The amount confirmed
          at checkout, and later invoices, are the charge. The application does
          not keep a second price list that can override Stripe.
        </p>
      </LegalSection>

      <LegalSection id="billing" title="5. Changes, cancellation, and what access remains">
        <p>
          You can choose Builder or Business from billing, and you can upgrade
          from Builder to Business. Extra Business users are added from Team.
          A plan or seat change takes effect when billing confirms it. If
          payment for an upgrade does not complete, you stay on the plan
          billing has already confirmed.
        </p>
        <p>
          You cancel in the Stripe billing portal. Access to create estimates,
          create or send quotes, and manage the team continues until the
          service end. That time is the earlier of the cancellation time and
          the end of the current billing period. It is not extended past that
          earlier time. After the service end, those new-work actions stop.
          Accepting a quote that was already sent can still be completed. The
          same block on new work applies when a trial has ended, or when a
          paid subscription is unpaid or paused.
        </p>
        <p>
          If a payment is past due, full access continues for seven days from
          the time the payment became past due, with a billing warning. The
          seventh-day instant is outside that window. If that start time is
          missing, the grace period is not given. After the window, new work is
          blocked until the payment is resolved.
        </p>
        <p>
          The application does not delete projects, estimates, pricing, or
          quotes when a trial ends or a subscription is cancelled. It also does
          not currently switch view access off after a set number of days. A
          90-day figure exists in the billing code and is not applied. There is
          no full-account download.
        </p>
        <p>
          Proposed, not yet approved: cancellation or the end of a trial would
          leave existing work open to view for 90 days after the service end,
          and sign-in access to that job content would then stop. Billing and
          tax records would be kept for seven years because New Zealand
          business records are generally kept for that long. Job notes, photos,
          and customer details would not be kept for those seven years. This
          cutoff is not running. Approving it means a later change has to
          enforce it. Until then, the current behaviour above is what the
          application does. Nothing in this proposal refunds a fee.
        </p>
      </LegalSection>

      <LegalSection id="refunds" title="6. Refunds — proposed, not yet approved">
        <p>
          Proposed, not yet approved: fees are billed in advance. Cancelling
          stops the next renewal. It does not by itself refund the period you
          are in. A fee paid for a period you could not use because we failed
          to provide the service, and any refund the law requires, would still
          be paid. This draft does not adopt a blanket no-refund rule. If this
          proposal is rejected, a different refund rule has to be written
          before these terms are used.
        </p>
      </LegalSection>

      <LegalSection id="information" title="7. Your information">
        <p>
          You keep ownership of the job information, files, prices, and
          customer details you put into Quotr. We do not claim that work as
          ours.
        </p>
        <p>
          You give us permission to host, store, back up, and display that
          information so we can provide the service, including to people you
          invite and to a customer you send a quote or variation to. If you use
          an analysis or assistant feature, you also give permission for the
          relevant text to be sent to Anthropic as the Privacy Notice
          describes, so that feature can return a result.
        </p>
        <p>
          You confirm that you have the right to enter that information and to
          send it to your customer. You are responsible for what the quote
          says.
        </p>
      </LegalSection>

      <LegalSection id="use" title="8. Acceptable use and security">
        <p>
          Use Quotr for your own estimating and quoting. Do not misuse it. In
          particular, do not break the law with it, interfere with the service,
          attempt to get another organisation’s information, or send malware.
        </p>
        <p>
          Keep the password confidential and tell us, once a monitored contact
          is published, if you believe the account is compromised. We may
          require a new password or suspend access if that is reasonably needed
          to protect the service or another person’s information. Where that
          can be done without adding to the harm, we will use the account email
          before access ends.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="9. Changes to the service and these terms">
        <p>
          We may change features, including features still in preview. A change
          to these terms will use a new version number. The version stored on
          an account is the version that account accepted. An older account is
          not treated as having accepted a later version unless that acceptance
          is recorded. Existing acceptance records are not rewritten. If you do
          not agree to a later version, you can cancel under section 5.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="10. Liability — including proposals">
        <p>
          We provide Quotr with reasonable care. We do not guarantee that an
          estimate, quantity, benchmark, or price is accurate, complete, or fit
          for a particular job. You check the work before you send it or rely
          on it.
        </p>
        <p>
          Proposed, not yet approved: we would not be liable for profit you
          expected from a job, or for a price you chose to send, except where
          the law does not allow that exclusion. No dollar cap is proposed in
          this draft. No unlimited indemnity is proposed. If a cap is wanted,
          it has to be written and approved before these terms are used. A cap
          cannot apply to liability that the law says cannot be limited.
        </p>
        <p>
          Nothing in these terms excludes or limits a right that cannot
          lawfully be excluded. That includes rights under the Fair Trading Act
          1986, and rights under the Consumer Guarantees Act 1993 where that
          Act applies and has not been contracted out of.
        </p>
        <p>
          Proposed, not yet approved: where you acquire Quotr in trade, and it
          is fair and reasonable to do so, the Consumer Guarantees Act 1993
          would not apply to the application. That proposal is not in force.
          It would not remove Fair Trading Act rights, or any guarantee the law
          does not allow to be contracted out of. If this proposal is rejected,
          the Act continues to apply wherever it applies.
        </p>
      </LegalSection>

      <LegalSection id="law" title="11. Complaints and New Zealand law">
        <p>
          A complaint can be sent once a monitored contact is published in
          these terms. That contact is not published in this draft. You can
          also take a privacy complaint to the Privacy Commissioner, as the
          Privacy Notice explains.
        </p>
        <p>
          Proposed, not yet approved: these terms would use New Zealand law, and
          the courts of New Zealand could hear a dispute about them. That
          choice would not remove a right a law says you keep.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
