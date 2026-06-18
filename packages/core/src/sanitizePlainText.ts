import DOMPurify from "isomorphic-dompurify";

/** Strip HTML/script content; safe for plain-text fields stored or rendered as text. */
export function sanitizePlainText(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}
