// Minimum participants for a round's anonymity to actually mean something.
// With 2 people, the only feedback you receive is necessarily from the one
// other person → fully deanonymized. 3 is the floor; raise to 4+ for stronger
// anonymity. Lower to 2 only for local testing.
export const MIN_PARTICIPANTS = 3
