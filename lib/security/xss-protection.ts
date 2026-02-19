// XSS (Cross-Site Scripting) protection

import DOMPurify from "isomorphic-dompurify";

export class XSSProtection {
  /**
   * Sanitize HTML content
   * Allows only safe HTML tags
   */
  static sanitizeHTML(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
      ALLOWED_ATTR: ["href", "target", "rel"],
      ALLOW_DATA_ATTR: false,
    });
  }

  /**
   * Escape HTML special characters for display
   * Use this when displaying user input as plain text
   */
  static escapeHTML(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "/": "&#x2F;",
    };

    return text.replace(/[&<>"'/]/g, (char) => map[char]);
  }

  /**
   * Strip all HTML tags
   * Useful for search queries, names, etc.
   */
  static stripHTML(text: string): string {
    return DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  /**
   * Sanitize JSON object recursively
   * Escapes all string values
   */
  static sanitizeJSON(input: any): any {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === "string") {
      return this.escapeHTML(input);
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitizeJSON(item));
    }

    if (typeof input === "object") {
      const sanitized: any = {};
      for (const key in input) {
        sanitized[key] = this.sanitizeJSON(input[key]);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Validate and sanitize email address
   */
  static sanitizeEmail(email: string): string {
    // Remove any HTML
    const clean = this.stripHTML(email).trim().toLowerCase();

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) {
      throw new Error("Invalid email format");
    }

    return clean;
  }

  /**
   * Validate and sanitize URL
   * Only allows http and https protocols
   */
  static sanitizeURL(url: string): string {
    try {
      const clean = this.stripHTML(url).trim();
      const parsed = new URL(clean);

      // Only allow http and https
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid URL protocol");
      }

      return parsed.toString();
    } catch (error) {
      throw new Error("Invalid URL format");
    }
  }
}
