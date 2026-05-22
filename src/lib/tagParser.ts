const TAG_REGEX = /#([a-zA-Z가-힣0-9_-]+)/g;

export function parseTags(content: string): string[] {
  const tags: string[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex in case of reuse
  TAG_REGEX.lastIndex = 0;

  while ((match = TAG_REGEX.exec(content)) !== null) {
    const tag = match[1];
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}
