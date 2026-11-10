<?php

namespace App\Support;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Mpdf\Config\ConfigVariables;
use Mpdf\Config\FontVariables;
use Mpdf\Language\LanguageToFont;
use Mpdf\Mpdf;
use Symfony\Component\HttpFoundation\HeaderUtils;

/**
 * A booking PDF (voucher, rental agreement) in English or Tamil.
 *
 * English keeps DomPDF. DomPDF cannot shape Tamil (vowel signs such as
 * கொ / கை come out in the wrong order), so Tamil documents are drawn by
 * mPDF, which shapes the script with Noto Sans Tamil (resources/fonts).
 * Keep the 2.002 build of that font: newer builds use mark filtering sets,
 * which mPDF 8 refuses ("contains MarkGlyphSets - Not tested yet").
 * The views get `$mpdf` so they can use mPDF's own page footer.
 */
class PdfDocument
{
    private function __construct(private string $html, private string $locale, private bool $mpdf) {}

    /**
     * The document's language: ?lang=en|ta when given (the shop prints a Tamil copy for its
     * customer from the English panel), otherwise the request's locale (X-Locale).
     */
    public static function localeFrom(Request $request): string
    {
        $lang = $request->query('lang');

        return in_array($lang, config('app.supported_locales', []), true) ? $lang : app()->getLocale();
    }

    /** Render $view in $locale. The app locale (labels, month names) is restored afterwards. */
    public static function make(string $view, array $data, string $locale): self
    {
        $previous = app()->getLocale();
        app()->setLocale($locale);
        $mpdf = $locale !== 'en';

        try {
            $html = view($view, $data + ['mpdf' => $mpdf, 'locale' => $locale])->render();
        } finally {
            app()->setLocale($previous);
        }

        return new self($html, $locale, $mpdf);
    }

    /** "BKG-123.pdf", or "BKG-123-ta.pdf" for a translated copy. */
    public function filename(string $base): string
    {
        return $base . ($this->locale === 'en' ? '' : "-{$this->locale}") . '.pdf';
    }

    public function output(): string
    {
        return $this->mpdf ? $this->mpdf()->Output('', 'S') : Pdf::loadHTML($this->html)->setPaper('a4')->output();
    }

    /** Inline (view in the browser) or as a download. */
    public function response(string $base, bool $download): Response
    {
        $filename = $this->filename($base);

        return response($this->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => HeaderUtils::makeDisposition($download ? 'attachment' : 'inline', $filename),
        ]);
    }

    private function mpdf(): Mpdf
    {
        $fontDirs = (new ConfigVariables())->getDefaults()['fontDir'];
        $fontData = (new FontVariables())->getDefaults()['fontdata'];
        $tempDir = storage_path('framework/cache/mpdf');
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0775, true);
        }

        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'tempDir' => $tempDir,
            'fontDir' => [...$fontDirs, resource_path('fonts')],
            'fontdata' => $fontData + [
                'notosanstamil' => [
                    'R' => 'NotoSansTamil-Regular.ttf',
                    'B' => 'NotoSansTamil-Bold.ttf',
                    'useOTL' => 0xFF,
                ],
            ],
            'default_font' => 'dejavusans',
            // Tamil runs switch to Noto Sans Tamil; Latin text (names, numbers) stays in DejaVu Sans.
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
            // Noto Sans Tamil has no "&" etc. — borrow missing glyphs from DejaVu Sans.
            'useSubstitutions' => true,
            'languageToFont' => new class extends LanguageToFont {
                public function getLanguageOptions($llcc, $adobeCJK)
                {
                    return in_array(strtolower(explode('-', $llcc)[0]), ['ta', 'tam'], true)
                        ? [false, 'notosanstamil']
                        : parent::getLanguageOptions($llcc, $adobeCJK);
                }
            },
            // Keep the font sizes the views ask for; Tamil labels are longer, tables just grow.
            'shrink_tables_to_fit' => 1,
        ]);
        $mpdf->SetTitle(strip_tags((string) (preg_match('#<title>(.*?)</title>#s', $this->html, $m) ? $m[1] : '')));
        $mpdf->WriteHTML($this->html);

        return $mpdf;
    }
}
