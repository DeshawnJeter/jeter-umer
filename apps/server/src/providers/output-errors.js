// Only these trusted diagnoses may be fed back to a model. Never echo rejected
// output, provider error bodies, or arbitrary exception text into instructions.
const diagnoses = Object.freeze({
  json: 'Return one JSON object, without markdown or executable text.',
  shape: 'Return exactly the fields in the structured schema. Checkers wrap their report in review.',
  schema: 'Follow every required field, type, enum, length and array bound in the structured schema.',
  summary: 'Supply a nonblank worker summary of at most 500 characters.',
  proposal: 'Use kind artifact with artifact populated and question null, or kind question with artifact null and a valid blocking question.',
  question: 'Supply a blocking question: lowercase key matching ^[a-z][a-z0-9_.-]{0,79}$ (no constructor/prototype/__proto__ segments); text 1–400 characters; reason 1–600; at most 6 unique trimmed options of 1–100 characters; maxLength an integer 1–1000 large enough for every option and recommendation (use 500); recommended empty or an exact offered option; affectedRoles only known role IDs. Do not invent human answers.',
  checker: 'Supply nonempty static evidence and bounded, nonblank findings/evidence strings.',
  contradiction: 'A pass requires findings=[] and question=null. A fail requires actual repair findings and question=null. needs_human requires a valid blocking question. Never turn unresolved defects into a pass.'
});
export class ModelOutputError extends Error {
  constructor(code, message = diagnoses[code]) {
    if (!Object.hasOwn(diagnoses, code)) throw new Error('Unknown model output diagnosis');
    super(message); this.name = 'ModelOutputError'; this.code = code;
  }
}
export function repairInstruction(code) {
  if (!Object.hasOwn(diagnoses, code)) throw new Error('Unknown model output diagnosis');
  return `The previous completed response failed local protocol validation. ${diagnoses[code]} Regenerate a complete response for the original task and unchanged supplied artifact. Do not weaken requirements, discard defects, or invent evidence. Rejected output is intentionally not included.`;
}
