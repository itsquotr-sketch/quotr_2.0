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
          These Application Terms are version {TERMS_OF_USE_VERSION}, dated 22
          October 2026. They apply to an account in the Quotr application. The
          website terms at get-quotr.com govern only the public website.
        </p>
        <p>
          Quotr is supplied by Flowra Limited, trading as Quotr. Flowra
          Limited’s NZBN is 9429052916465. Its public location is Auckland, New
          Zealand. Support, privacy, and complaints: hello@get-quotr.com.
        </p>
        <p>
          “You” means the person who creates the account and the organisation
          that person acts for. “We” and “us” mean Flowra Limited. The{" "}
          <Link href={PRIVACY_POLICY_URL} className="underline underline-offset-4">
            Privacy Notice
          </Link>{" "}
          explains how personal information is handled.
        </p>
      </LegalSection>

      <LegalSection id="account" title="2. Accounts, authority, and team access">
        <p>
          To create an account you give your name, work email, phone number,
          and a password, and you name the organisation. You confirm the email
          address before the account can be used. The phone number is stored
          with the account. It is not used to sign in, and we do not text it.
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
          Results depend on what you enter and on the assumptions still open in
          the job. We do not visit the site, check the plans, or decide what
          you should charge. You review quantities, assumptions, benchmarks,
          and prices before you rely on them or send them to a customer. An
          estimate or quote is your document. We provide the service with
          reasonable care. We do not guarantee that an estimate, quantity,
          benchmark, or price is accurate, complete, or fit for a particular
          job.
        </p>
        <p>
          GST on a quote you send is your GST treatment. It is separate from
          GST on a subscription you pay us. If you tell Quotr you are not GST
          registered, quote GST is not added from that choice. An NZBN stored
          on the organisation is not used to decide GST registration.
        </p>
      </LegalSection>

      <LegalSection id="plans" title="4. Trial, plans, and payment">
        <p>
          A new organisation starts a 14-day trial. The trial does not ask for
          a card. During the trial the organisation has Business features for
          one user. When the trial ends, new estimating and quoting work stops.
          Work already in the account remains available to view.
        </p>
        <p>
          Paid plans are monthly subscriptions in New Zealand dollars, billed
          through Stripe. A subscription renews each month until you cancel.
          The application shows Quotr Builder at $65 a month, Quotr Business at
          $79 a month, and an extra Business user at $35 a month. Those amounts
          are exclusive of GST. Where New Zealand GST applies to the
          subscription, GST of 15% is added on top. The amount you confirm at
          checkout, and later invoices, are what you pay.
        </p>
        <p>
          You can choose Builder or Business from billing, and you can upgrade
          from Builder to Business. Extra Business users are added from Team. A
          plan or seat change takes effect when billing confirms it. If payment
          for an upgrade does not complete, you stay on the plan that billing
          has already confirmed.
        </p>
      </LegalSection>

      <LegalSection id="billing" title="5. Cancellation, non-payment, and viewing">
        <p>
          You cancel in the Stripe billing portal. Cancellation stops the next
          renewal. It does not, by itself, refund the period you have already
          paid for. Any refund or other remedy that the law requires is still
          available. A complaint about a charge can be sent to
          hello@get-quotr.com.
        </p>
        <p>
          Until the service ends, you can keep creating estimates, creating and
          sending quotes, and managing the team. The service ends at the
          earlier of the cancellation time and the end of the current billing
          period. After that, those new-work actions stop. The same stop
          applies when a trial has ended, or when a paid subscription is unpaid
          or paused.
        </p>
        <p>
          If a payment is past due, full access continues for seven days from
          the time the payment became past due, and you see a billing warning.
          Access to new work stops at the end of that seven days unless the
          payment is resolved. If we do not have the time the payment became
          past due, that seven-day period is not given.
        </p>
        <p>
          After the service ends, existing projects, estimates, pricing, and
          quotes stay available to view, and a quote that was already sent can
          still be accepted. Cancelling a subscription does not delete those
          records and is not a request to close the account. There is no
          download of the whole account.
        </p>
      </LegalSection>

      <LegalSection id="information" title="6. Your information">
        <p>
          You keep ownership of the job information, files, prices, and
          customer details you put into Quotr. We do not claim that work as
          ours.
        </p>
        <p>
          You give us permission to host, store, back up, and display that
          information so we can provide the service. That includes display to
          people you invite, and to a customer, supplier, or other recipient
          you send a quote, variation, price request, or invitation to. If you
          use an analysis or assistant feature, you also give permission for
          the relevant text to be sent to Anthropic, as the Privacy Notice
          describes, so that feature can return a result.
        </p>
        <p>
          You are responsible for having a proper reason to enter someone
          else’s details and for what the quote says. That responsibility does
          not remove our own duties in handling the information.
        </p>
      </LegalSection>

      <LegalSection id="use" title="7. Acceptable use and security">
        <p>
          Use Quotr for your own estimating and quoting. Do not break the law
          with it, interfere with the service, attempt to obtain another
          organisation’s information, or send malware.
        </p>
        <p>
          Keep the password confidential. Email hello@get-quotr.com if you
          believe the account is compromised. We may require a new password or
          suspend access where that is reasonably needed to protect the service
          or another person’s information. Where we can do so without adding to
          the harm, we will write to the account email before access ends.
        </p>
      </LegalSection>

      <LegalSection id="closure" title="8. Closing an account and asking for deletion">
        <p>
          Email hello@get-quotr.com to ask us to close the account or to delete
          personal information. That request is separate from cancelling a
          subscription. We keep information while it is needed to provide the
          account, to meet a legal duty, to resolve a dispute, or to protect
          the service. Subscription and tax records may need to be kept for the
          period New Zealand tax law requires for business records. Job notes,
          photos, quotes, and customer details are not kept merely to fill that
          tax period. We will delete information when we no longer need it for
          a purpose above, or when the law requires deletion. There is no
          automatic deletion switch.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="9. Changes">
        <p>
          We may change the application, including features that are still in
          preview. If these terms change, the new version will have its own
          version number. We will not treat an existing account as having
          accepted a later version unless you accept that version. If you do
          not agree to a later version, you can cancel under section 5.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="10. Liability and rights that remain">
        <p>
          Nothing in these terms excludes or limits a right that cannot
          lawfully be excluded. That includes rights under the Fair Trading Act
          1986, and rights under the Consumer Guarantees Act 1993 where that
          Act applies to you. These terms do not set a dollar limit on our
          liability, do not require you to cover us without limit, and do not
          contract out of the Consumer Guarantees Act.
        </p>
      </LegalSection>

      <LegalSection id="law" title="11. Complaints and New Zealand law">
        <p>
          Complaints go to hello@get-quotr.com. Include the account email and
          what you would like us to do. You can also complain to the Office of
          the Privacy Commissioner at privacy.org.nz, as the Privacy Notice
          explains.
        </p>
        <p>
          These terms use New Zealand law. The courts of New Zealand can hear a
          dispute about them. That does not stop you using a right that another
          law says you must be allowed to use, and it does not give those
          courts the only right to hear a dispute where a mandatory law says
          otherwise.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
