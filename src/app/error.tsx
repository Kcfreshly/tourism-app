"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="card">
      <h1>We couldn’t load this page.</h1>
      <p>
        Your saved draft remains in the database. Check local setup and retry.
      </p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
