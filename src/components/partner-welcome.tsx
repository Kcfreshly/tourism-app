import Link from "next/link";

const apply = "/account?next=/partner&mode=signup";
const signIn = "/account?next=/partner";

// /partner for someone who isn't signed in: what partnering is, how it
// works, and the two ways in. Partners use the same account as travellers.
export default function PartnerWelcome() {
  return (
    <section className="admin-page partner-page partner-welcome">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Fastlife partners</p>
          <h1>Sell your activities and trips on Fastlife</h1>
          <p>
            Tours, boat rides, venues, events and multi-day trips. Travellers
            find you, book and pay here; you confirm and run the experience.
          </p>
          <div className="actions">
            <Link className="button" href={apply}>
              Apply to become a partner
            </Link>
            <Link className="button secondary" href={signIn}>
              Partner sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="card partner-panel" aria-labelledby="partner-how">
        <h2 id="partner-how">How it works</h2>
        <ol className="steps partner-steps">
          <li>
            <span className="step-number">1</span>
            <h3>Create an account and apply</h3>
            <p>
              Tell us your business name, contact details and what you run. It
              takes two minutes.
            </p>
          </li>
          <li>
            <span className="step-number">2</span>
            <h3>We verify your business</h3>
            <p>
              Our team checks your details and may call you. You’ll see the
              result when you sign in.
            </p>
          </li>
          <li>
            <span className="step-number">3</span>
            <h3>Add your listings</h3>
            <p>
              Describe each activity or trip, set prices and dates, add photos,
              and send it to us for review.
            </p>
          </li>
          <li>
            <span className="step-number">4</span>
            <h3>Go live and get bookings</h3>
            <p>
              Once approved, travellers can book. Your dashboard shows views,
              visitors and sales.
            </p>
          </li>
        </ol>
      </section>

      <section className="card partner-panel" aria-labelledby="partner-ways">
        <h2 id="partner-ways">Ways in</h2>
        <ul className="partner-ways">
          <li>
            <h3>New to Fastlife</h3>
            <p>Create an account, then fill in the short application.</p>
            <Link className="text-link" href={apply}>
              Apply to become a partner
            </Link>
          </li>
          <li>
            <h3>Already applied or a partner</h3>
            <p>Sign in with the account you applied with.</p>
            <Link className="text-link" href={signIn}>
              Partner sign in
            </Link>
          </li>
          <li>
            <h3>Got an invitation link?</h3>
            <p>
              Open the link we sent you. It sets up your verified partner
              account straight away, with no application to wait on.
            </p>
          </li>
        </ul>
      </section>
    </section>
  );
}
