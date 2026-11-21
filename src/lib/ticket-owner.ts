export function ticketOwnerName(ticket: {
  user: { fullName: string } | null;
  guestName: string | null;
}) {
  return ticket.user?.fullName ?? ticket.guestName ?? "Jugador presencial";
}
