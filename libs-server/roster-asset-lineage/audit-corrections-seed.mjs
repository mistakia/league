// Append-only seed of holdings flagged as audit_corrected with a
// human-readable correction_note. Append entries here; the generator
// applies them after holding inserts via a (lid, tid, player_id,
// period_start_ts) match. period_start_ts is the unix-second timestamp
// of the holding's period_start; using a timestamp rather than holding_id
// keeps the seed stable across rebuilds.

const audit_corrections = [
  {
    lid: 1,
    tid: 11,
    player_id: 'AJXX-BROW-007507',
    period_start_ts: 1749074407,
    correction_note:
      '2025-06-03 RFA conditional-release bug: original processing dropped Max Levy (WLB) winning bid due to missing conditional-release records; player was awarded to Daniel Cohen (TTPD) at a lower price. Commissioner rolled back and reprocessed bids; WLB was awarded the player at the correct price.'
  }
]

export default audit_corrections
