<?php

namespace App\Support;

/**
 * Sanitizes rich-text HTML (from the frontend's Tiptap editor) before it is
 * stored — the editor's own schema already limits output to this tag set,
 * but this is the server-side backstop for anyone calling the API directly,
 * since the stored value is later rendered as raw HTML (PDF + in-app view).
 */
class Html
{
    private const ALLOWED_TAGS = '<p><strong><b><em><i><u><s><ul><ol><li><blockquote><a><br><h2><h3>';

    public static function sanitize(?string $html): ?string
    {
        if ($html === null || $html === '') {
            return $html;
        }

        $clean = strip_tags($html, self::ALLOWED_TAGS);

        // strip_tags only filters tag names — event handlers and javascript:
        // URIs on an otherwise-allowed tag (e.g. <a onmouseover=... href="javascript:...">) survive it.
        $clean = preg_replace('/\s+on\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $clean);
        $clean = preg_replace('/(href|src)\s*=\s*("|\')\s*javascript:[^"\']*("|\')/i', '$1=$2#$3', $clean);

        return $clean;
    }
}
