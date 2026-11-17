// Add optional wrapping points without changing the message, its spaces, or manual line breaks.
// Keep URL/email tokens, decimal/thousands separators, and ASCII dotted identifiers together.
export function messageTextSegments(text: string): string[] {
  const segments: string[] = [];
  const boundaries = /(https?:\/\/\S+|www\.\S+|(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,})|([.!?。！？,，、]+)/giu;
  let start = 0;
  for (const match of text.matchAll(boundaries)) {
    if (match[1]) continue;
    const previous = text[match.index - 1] ?? '';
    let end = match.index + match[0].length;
    const next = text[end] ?? '';
    if (/^[.,]$/.test(match[0]) && /\d/.test(previous) && /\d/.test(next)) continue;
    if (match[0] === '.' && /[a-z\d]/i.test(previous) && /[a-z\d]/i.test(next)) continue;
    while (end < text.length && /["'”’」』)\]}]/u.test(text[end])) end += 1;
    if (end === text.length || /\s/u.test(text[end])) continue;
    segments.push(text.slice(start, end));
    start = end;
  }
  segments.push(text.slice(start));
  return segments;
}

