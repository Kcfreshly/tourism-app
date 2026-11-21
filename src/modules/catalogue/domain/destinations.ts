// Destinations people can browse. Only cities with published inventory are
// listed; more are added as partners are onboarded.
export type Destination = {
  id: string;
  name: string;
  tagline: string;
  areas: { id: string; label: string }[];
};

export const destinations: Destination[] = [
  {
    id: "lagos",
    name: "Lagos",
    tagline: "your way.",
    areas: [
      { id: "LEKKI", label: "Lekki" },
      { id: "VI", label: "Victoria Island" },
      { id: "MAINLAND", label: "Mainland" },
    ],
  },
    {
    id: "abuja",
    name: "Abuja",
    tagline: "your way.",
    areas: [
      { id: "Wuse", label: "Wuse" },
      { id: "Garki", label: "Garki" },
      { id: "Jabi", label: "Jabi" },
    ],
  },
];

export const defaultDestination = destinations[0];

export function destinationById(id?: string) {
  return destinations.find((d) => d.id === id);
}
