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
          the terms for an account in the Quotr application. They are separate
          from the website terms at get-quotr.com, which govern only the public
          website.
        </p>
        <p>
          Quotr helps a building business turn job notes into an estimate and a
          quote. The registered name, company number, and address of the
          business that supplies Quotr will be added to this section before
          these terms are used for new Production accounts. Until that name is
          published, these terms are a draft.
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
          with the account. It is not used to sign in, and Quotr does not text
          it.
        </p>
        <p>
          You confirm that you are allowed to open the account for that
          organisation and to bind it to these terms. If you are not, do not
          create the account.
        </p>
        <p>
          You can invite other people into the organisation. They get the
          access that goes with the role you give them. You are responsible for
          who you invite and for removing access when someone should no longer
          have it. Builder includes one user. Business includes one user and
          can add further users up to five in total. A custom arrangement, if
          we agree one, is set outside self-serve checkout.
        </p>
      </LegalSection>

      <LegalSection id="service" title="3. The estimating and quoting service">
        <p>
          Quotr provides tools to record a job, calculate an estimate, set
          prices, and prepare a quote or variation for your customer. Some
          calculations use your rates, your calibrations, or Quotr benchmarks.
          You choose whether benchmarks are used. Where you have entered a
          company rate, that rate is used instead of the benchmark.
        </p>
        <p>
          Outputs depend on what you enter and on the assumptions still open in
          the job. Quotr does not visit the site, check the plans, or decide
          what you should charge. You review quantities, assumptions,
          benchmarks, and prices before you rely on them or send them to a
          customer. An estimate or quote is your document. It is not our advice,
          and it is not a promise that the job will cost that amount.
        </p>
        <p>
          GST on a quote you send is your GST treatment. It is separate from
          GST on the subscription you pay us. If you tell Quotr you are not GST
          registered, quote GST is not added from that choice. Your NZBN is not
          used to decide GST registration.
        </p>
      </LegalSection>

      <LegalSection id="plans" title="4. Trial, plans, and GST on our fees">
        <p>
          A new organisation starts a 14-day trial. The trial does not ask for a
          card. During the trial you have Business features for one user. When
          the trial ends, existing projects, estimates, pricing, and quotes stay
          available to view. Creating and sending new work needs a paid plan.
        </p>
        <p>
          Paid plans are billed monthly in New Zealand dollars through Stripe.
          The application currently shows Quotr Builder at $65 a month and Quotr
          Business at $79 a month, plus GST. An extra Business user is shown at
          $35 a month, plus GST. GST on these fees is 15% and is added on top of
          the monthly amount. The amount you confirm at checkout, and later
          invoices, are the charge. If a displayed amount and Stripe ever
          differ, the Stripe amount you confirm is the one you pay.
        </p>
      </LegalSection>

      <LegalSection id="billing" title="5. Changes, cancellation, and service end">
        <p>
          You can choose Builder or Business from billing, and you can upgrade
          from Builder to Business. Extra Business users are added from Team.
          Seat changes and plan changes take effect when billing confirms them.
          If a payment for an upgrade does not complete, you stay on the plan
          billing has confirmed.
        </p>
        <p>
          You cancel from the billing portal. Cancellation is scheduled. Access
          to create and send new work continues until the service end. That
          time is the earlier of the cancellation time and the end of the
          current billing period. It is not extended to a later date. After the
          service end, existing work stays available to view. The same view
          access applies if a paid subscription is unpaid or paused.
        </p>
        <p>
          If a payment is past due, full access continues for seven days with a
          warning, counted from when the payment became past due. After that,
          access returns to viewing existing work until the payment is resolved.
        </p>
        <p>
          This version does not set a refund rule. Cancellation stops the next
          renewal. It does not, by itself, refund the period you are in. A
          refund rule will be added here only if it is approved. Nothing in
          this section removes a refund or remedy that the law requires.
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
          information so we can provide the service, including to people you
          invite and to a customer you send a quote or variation to. If you use
          an analysis or assistant feature, you also give us permission to send
          the relevant text to the provider described in the Privacy Notice,
          so that feature can return a result.
        </p>
        <p>
          You confirm that you have the right to enter that information and to
          send it to your customer. You are responsible for what the quote says.
        </p>
      </LegalSection>

      <LegalSection id="use" title="7. Acceptable use and security">
        <p>
          Use Quotr for your own estimating and quoting. Do not misuse it. In
          particular, do not break the law with it, interfere with the service,
          attempt to get another organisation’s information, send malware, or
          use the service to build a competing copy of Quotr.
        </p>
        <p>
          Keep the password confidential and tell us if you believe the account
          is compromised. We may sign the account out, require a new password,
          or suspend access if we reasonably need to protect the service or
          another person’s information.
        </p>
      </LegalSection>

      <LegalSection id="end" title="8. Suspension, ending the account, and retrieval">
        <p>
          You can stop using Quotr at any time. We may suspend or end access if
          fees remain unpaid after the period in section 5, if the use breaches
          these terms in a serious way, or if we need to protect the service.
          Where we can do so without adding to the harm, we will tell the
          account email before access ends.
        </p>
        <p>
          While the account is open, and during view access after a trial or a
          cancelled subscription, you can open the projects, estimates, pricing,
          and quotes the application already shows you, and you can use the
          print and send actions those screens provide. This version does not
          promise a separate download of the whole account. You can ask for a
          copy of personal information as described in the Privacy Notice.
        </p>
        <p>
          This version does not set a general deletion period after an account
          closes. We will not delete current job records merely because a
          subscription ends. How long closed-account information is kept will
          be stated here before these terms are used in Production.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="9. Changes">
        <p>
          We may change the application, including features that are still in
          preview. A change to these terms will use a new version number. The
          version you accepted is the one stored with your account. We will not
          treat an older account as having accepted a later version unless you
          accept that version. If you do not agree to a new version, you can
          cancel. Existing acceptance records are not rewritten.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="10. Liability and rights that remain">
        <p>
          We provide Quotr with reasonable care. We do not guarantee that an
          estimate, quantity, benchmark, or price is accurate, complete, or fit
          for a particular job. You check the work before you send it or rely
          on it.
        </p>
        <p>
          This version does not set a dollar cap on our liability, and it does
          not ask you to indemnify us without limit. We are not liable for
          profit you expected to make on a job, or for a price you chose to
          send, except where the law does not allow that exclusion.
        </p>
        <p>
          Nothing in these terms excludes or limits a right that cannot
          lawfully be excluded. That includes rights under the Fair Trading Act
          1986, and rights under the Consumer Guarantees Act 1993 where that
          Act applies and cannot be contracted out of. This draft does not
          contain a business contracting-out clause. If you are using Quotr in
          trade, do not read this section as a contracting-out of the Consumer
          Guarantees Act.
        </p>
      </LegalSection>

      <LegalSection id="law" title="11. Complaints and New Zealand law">
        <p>
          If something goes wrong, email privacy@quotr.co.nz and include the
          account email and what you would like us to do. We will look into a
          complaint and respond. You can also take a privacy complaint to the
          Privacy Commissioner, as the Privacy Notice explains.
        </p>
        <p>
          These terms use New Zealand law. The courts of New Zealand can hear a
          dispute about them. That choice does not remove a right a law says
          you keep.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
