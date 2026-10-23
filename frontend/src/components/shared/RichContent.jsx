"use client";

import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

const ALLOWED_TAGS = ["p", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a", "br", "h2", "h3"];

/** Renders trusted-shape rich text (from RichTextEditor) as sanitized HTML — never pass raw user/API HTML without this. */
export function RichContent({ html, className }) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ["href", "target", "rel"] });
  return <div className={cn("rich-content", className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}
