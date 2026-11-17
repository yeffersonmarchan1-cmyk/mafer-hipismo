export const raceDayVenues = ["La Rinconada", "Valencia"] as const;

export type RaceDayVenue = (typeof raceDayVenues)[number];

export function isRaceDayVenue(value: unknown): value is RaceDayVenue {
  return raceDayVenues.some((venue) => venue === value);
}

export function isRaceDayPlayable(entries: readonly { legNumber: number }[]) {
  return Array.from({ length: 6 }, (_, index) =>
    entries.some((entry) => entry.legNumber === index + 1),
  ).every(Boolean);
}

export function raceDayVenueLabel(venue: string) {
  return venue === "Valencia" ? "Hipódromo de Valencia" : "Hipódromo La Rinconada";
}
