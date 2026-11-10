"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold, Heading2, Heading3, Italic, List, ListOrdered, Minus, Quote, Redo2, Strikethrough, Underline, Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small rich text editor (bold, italic, underline, headings, lists, quote, divider).
 * Only formatting the server keeps is offered — links, code and images are left out.
 */
export function RichTextEditor({ value, onChange, disabled = false, placeholder = "", minHeight = "min-h-[320px]" }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false, code: false, codeBlock: false, heading: { levels: [2, 3] } })],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    editorProps: { attributes: { class: cn("rich-text px-4 py-3 text-sm outline-none", minHeight) } },
    onUpdate: ({ editor: e }) => onChange?.(e.isEmpty ? "" : e.getHTML()),
  });

  // Outside changes (loaded terms, "start from a sample") replace the content.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if ((value || "") !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? {
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), quote: e.isActive("blockquote"),
      canUndo: e.can().undo(), canRedo: e.can().redo(), empty: e.isEmpty,
    } : {}),
  }) ?? {};

  const chain = () => editor.chain().focus();
  const tools = [
    { icon: Bold, label: "Bold", active: state.bold, run: () => chain().toggleBold().run() },
    { icon: Italic, label: "Italic", active: state.italic, run: () => chain().toggleItalic().run() },
    { icon: Underline, label: "Underline", active: state.underline, run: () => chain().toggleUnderline().run() },
    { icon: Strikethrough, label: "Strikethrough", active: state.strike, run: () => chain().toggleStrike().run() },
    null,
    { icon: Heading2, label: "Heading", active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
    { icon: Heading3, label: "Sub-heading", active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    null,
    { icon: List, label: "Bullet list", active: state.bullet, run: () => chain().toggleBulletList().run() },
    { icon: ListOrdered, label: "Numbered list", active: state.ordered, run: () => chain().toggleOrderedList().run() },
    { icon: Quote, label: "Quote", active: state.quote, run: () => chain().toggleBlockquote().run() },
    { icon: Minus, label: "Divider", run: () => chain().setHorizontalRule().run() },
    null,
    { icon: Undo2, label: "Undo", off: !state.canUndo, run: () => chain().undo().run() },
    { icon: Redo2, label: "Redo", off: !state.canRedo, run: () => chain().redo().run() },
  ];

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring", disabled && "opacity-70")}>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1">
          {tools.map((t, i) => t === null ? (
            <span key={`sep-${i}`} className="mx-1 h-5 w-px bg-border" />
          ) : (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={!!t.active}
              disabled={!editor || t.off}
              onClick={t.run}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
                t.active && "bg-background text-foreground shadow-sm",
              )}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      )}
      <div className="relative max-h-[60vh] overflow-y-auto">
        {state.empty && placeholder && (
          <p className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
