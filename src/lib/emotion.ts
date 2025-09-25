
export type Emotion = 'neutral' | 'happy' | 'excited' | 'serious' | 'sad' | 'angry';

const TAG_PATTERN = /^\s*\[([a-z_]+)\]\s*/i;

export function parseLeadingEmotionTag(text: string): { emotion: Emotion; stripped: string } {
  const m = text.match(TAG_PATTERN);
  if (!m) return { emotion: 'neutral', stripped: text };
  const tag = m[1].toLowerCase();
  const map: Record<string, Emotion> = {
    neutral: 'neutral',
    happy: 'happy',
    excited: 'excited',
    joy: 'happy',
    serious: 'serious',
    sad: 'sad',
    angry: 'angry',
  };
  return { emotion: map[tag] ?? 'neutral', stripped: text.replace(TAG_PATTERN, '') };
}

export function getExpressionCandidates(): Record<Emotion, string[]> {
  return {
    neutral: [],
    happy: ['smile', 'joy', 'smiley'],
    excited: ['excited', 'smile'],
    serious: ['serious', 'neutral'],
    sad: ['sad'],
    angry: ['angry'],
  };
}

export function pickOne(arr?: string[]) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}
