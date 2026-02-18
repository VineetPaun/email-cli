export function htmlToPlainText(html: string): string {
  let text = html;

  // Preserve common block boundaries before stripping tags.
  text = text.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  text = text.replace(/<\s*\/\s*p\s*>/gi, "\n\n");
  text = text.replace(/<\s*\/\s*div\s*>/gi, "\n");
  text = text.replace(/<\s*\/\s*li\s*>/gi, "\n");
  text = text.replace(/<\s*li\b[^>]*>/gi, "- ");

  // Strip remaining tags.
  text = text.replace(/<[^>]+>/g, "");

  // Decode minimal HTML entities commonly used in templates.
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize blank lines/spacing.
  text = text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
