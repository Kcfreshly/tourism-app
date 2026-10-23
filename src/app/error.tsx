"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="page">
      <div className="empty-state">
        <h1>We couldn’t load this page</h1>
        <p>
          Your saved trips and bucket are safe. Please try again in a moment.
        </p>
        <button onClick={reset}>Try again</button>
      </div>
    </section>
  );
}
