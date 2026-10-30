"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Link2, Undo2, Redo2,
} from "lucide-react";

function ToolbarButton({ onClick, active, disabled, label, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        "hover:bg-muted disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }) {
  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes("link").href;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1">
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={setLink}>
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

      <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}
//fhd
export function RichTextEditor({ label, error, required, className, value, onChange, placeholder, minHeight = "120px" }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rich-content focus:outline-none px-3.5 py-2.5 text-xs" },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  // Keep the editor in sync with externally-driven changes (template insert, form
  // reset) — but never while the user is actively typing, or the cursor would jump.
  useEffect(() => {
    if (!editor) return;
    const incoming = value || "";
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <Label className={required ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>
          {label}
        </Label>
      )}
      <div
        className={cn(
          "overflow-hidden rounded-md border border-input bg-background ring-offset-background",
          "focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30",
          error && "border-destructive",
        )}
      >
        <Toolbar editor={editor} />
        <EditorContent editor={editor} style={{ minHeight }} className="[&_.ProseMirror]:min-h-[inherit]" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
