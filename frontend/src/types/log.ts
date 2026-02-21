export type LogType =
  | 'phase'    // round markers
  | 'play'     // player actions (attack, thwart, card play)
  | 'damage'   // damage dealt, canceled, reduced, redirected
  | 'heal'     // healing
  | 'threat'   // threat placed or removed
  | 'status'   // stunned, confused, tough, exhausted changes
  | 'draw'     // cards drawn or added to hand
  | 'discard'  // cards discarded or defeated
  | 'villain'  // villain/minion activations, attachments, encounter cards
  | 'surge'    // surge triggered
  | 'system';  // errors, warnings, debug, rule violations

export interface LogEntry {
    id: number;
    round: number;
    type: LogType;
    message: string;
}
