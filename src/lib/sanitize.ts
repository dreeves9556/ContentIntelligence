import sanitizeHtml from "sanitize-html";

/**
 * Allow-list for admin-authored rich text that is rendered into the app with
 * `dangerouslySetInnerHTML`.
 *
 * Admin authorship is not a substitute for sanitisation: the announcement body
 * can be produced by the AI "enhance" action, and a single compromised admin
 * session would otherwise yield stored XSS on every user's dashboard.
 */
export const RICH_TEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code", "hr",
    "a", "u", "em", "strong", "s", "del", "span", "sub", "sup",
  ],
  allowedAttributes: {
    a: ["href", "class", "target", "rel"],
    span: ["style", "class"],
    p: ["style", "class"],
    h1: ["style"], h2: ["style"], h3: ["style"],
    h4: ["style"], h5: ["style"], h6: ["style"],
  },
  allowedStyles: {
    "*": {
      "text-align": [/^(left|center|right|justify)$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_SANITIZE_OPTIONS);
}
