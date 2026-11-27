import Link from "next/link";
import Icon from "./icons";

// Shortcuts for the main reasons people arrive. Each opens a normal path,
// already narrowed; nothing here is only for one kind of visitor.
const starts = [
  {
    icon: "sun",
    title: "Something to do this weekend",
    text: "Outings, events and days out near you.",
    href: "/explore?city=lagos&date=weekend",
  },
  {
    icon: "users",
    title: "A family day out",
    text: "Kid-friendly activities, with child prices.",
    href: "/explore?city=lagos&family=1",
  },
  {
    icon: "calendar",
    title: "Home for a visit?",
    text: "Add your dates and book a few things around family time.",
    href: "/explore?city=lagos&when=range",
  },
  {
    icon: "compass",
    title: "Planning a trip to Nigeria?",
    text: "Take a ready-made trip, or plan your own day by day.",
    href: "/packages",
  },
] as const;

export default function StartHere() {
  return (
    <section className="page-section start-here" aria-labelledby="start-title">
      <h2 id="start-title">Where would you like to start?</h2>
      <ul>
        {starts.map((s) => (
          <li key={s.title}>
            <Link href={s.href} className="start-tile">
              <span className="start-icon">
                <Icon name={s.icon} size={22} />
              </span>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
              <Icon name="arrowRight" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
