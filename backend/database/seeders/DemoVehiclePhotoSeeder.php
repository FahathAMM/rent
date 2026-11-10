<?php

namespace Database\Seeders;

use App\Models\Attachment;
use App\Models\Vehicle;
use App\Models\VehicleImage;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Real photos for the demo vehicles, from Wikimedia Commons (free
 * licences — CC0 / CC BY / CC BY-SA; each folder's credits.json records
 * title, author, licence and source for attribution).
 *
 * Photos are downloaded once per make/model into the public disk under
 * demo-vehicles/<model>/ and reused on later runs, so only the first run
 * needs network access. Every vehicle sharing a model points its
 * attachments at the same files (VehicleImageController only deletes a
 * file once no other attachment uses it). Vehicles that already have
 * photos are skipped, so this is safe to re-run.
 *
 *   php artisan db:seed --class=DemoVehiclePhotoSeeder
 */
class DemoVehiclePhotoSeeder extends Seeder
{
    private const DIR = 'demo-vehicles';
    private const PHOTOS_PER_MODEL = 5;
    private const PHOTOS_PER_VEHICLE = [3, 4];
    private const API = 'https://commons.wikimedia.org/w/api.php';

    /** Search terms where "<make> <model>" alone finds the wrong thing on Commons. */
    private const SEARCH_OVERRIDES = [
        'Toyota KDH' => 'Toyota HiAce H200',
        'Nissan Caravan' => 'Nissan NV350 Caravan',
        'Bajaj RE Three-wheeler' => 'Bajaj RE auto rickshaw',
        'TVS King' => 'TVS King auto rickshaw',
        'Ashok Leyland Lynx' => 'Ashok Leyland bus',
        'Suzuki Every' => 'Suzuki Every van',
        'Hero Pleasure' => 'Hero Pleasure scooter',
        'Yamaha Ray ZR' => 'Yamaha Cygnus', // no Ray ZR photos on Commons; a similar small Yamaha scooter
        'Yamaha FZ' => 'Yamaha FZ motorcycle',
        'Isuzu Elf' => 'Isuzu Elf truck',
        'Land Rover Defender' => 'Land Rover Defender 2020',
    ];

    /** Commons files whose titles say they aren't a clean exterior shot. */
    private const SKIP_TITLE_WORDS = [
        'interior', 'room', 'engine', 'dashboard', 'cockpit', 'seat', 'badge', 'emblem', 'logo',
        'wheel', 'rear view', 'trunk', 'boot', 'crash', 'wreck', 'accident', 'diagram', 'model car', 'toy',
    ];

    public function run(): void
    {
        $vehicles = Vehicle::doesntHave('images')->get(['id', 'shop_id', 'title', 'make', 'model', 'created_by']);
        if ($vehicles->isEmpty()) {
            $this->command?->info('Every vehicle already has photos — skipping.');
            return;
        }

        $attached = 0;
        $missing = [];

        foreach ($vehicles->groupBy(fn (Vehicle $v) => "{$v->make} {$v->model}") as $name => $group) {
            $photos = $this->photosFor($name);
            if (empty($photos)) {
                $missing[] = $name;
                continue;
            }

            foreach ($group as $vehicle) {
                $this->attach($vehicle, $photos);
                $attached++;
            }
        }

        $this->command?->info("Attached photos to {$attached} vehicles.");
        if ($missing) {
            $this->command?->warn('No photos found for: ' . implode(', ', $missing));
        }
    }

    /** @return string[] public-disk paths for this model, downloading them on first use */
    private function photosFor(string $name): array
    {
        $disk = Storage::disk('public');
        $folder = self::DIR . '/' . Str::slug($name);

        $paths = collect($disk->files($folder))->filter(fn ($p) => str_ends_with($p, '.jpg'))->values()->all();
        if (count($paths) >= self::PHOTOS_PER_VEHICLE[0]) {
            return $paths;
        }

        // First run, or an earlier run was cut short (e.g. rate limited) — top up.
        $this->command?->line("  downloading photos for {$name}…");

        $credits = $disk->exists("{$folder}/credits.json") ? json_decode($disk->get("{$folder}/credits.json"), true) : [];
        $have = array_column($credits, 'title');
        $next = count($paths);

        foreach ($this->search(self::SEARCH_OVERRIDES[$name] ?? $name, $name) as $file) {
            if (count($paths) >= self::PHOTOS_PER_MODEL) {
                break;
            }
            if (in_array($file['title'], $have, true) || !($body = $this->download($file['url']))) {
                continue;
            }

            $path = "{$folder}/" . (++$next) . '.jpg';
            $disk->put($path, $body);
            $paths[] = $path;
            $credits[] = ['file' => basename($path)] + array_diff_key($file, ['url' => true]);
        }

        if ($credits) {
            $disk->put("{$folder}/credits.json", json_encode($credits, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        return $paths;
    }

    /** Wikimedia rate-limits bursts of downloads (HTTP 429) — pace requests and back off when told to. */
    private function download(string $url): ?string
    {
        for ($attempt = 1; $attempt <= 4; $attempt++) {
            usleep(750_000);

            try {
                $response = Http::withHeaders(['User-Agent' => $this->userAgent()])->timeout(60)->get($url);
            } catch (\Throwable) {
                continue;
            }

            if ($response->successful()) {
                return $response->body();
            }
            if ($response->status() !== 429) {
                return null;
            }

            sleep(max((int) $response->header('Retry-After'), 5 * $attempt));
        }

        return null;
    }

    /** @return array<int, array{url: string, title: string, author: ?string, license: ?string, source: string}> */
    private function search(string $query, string $name): array
    {
        try {
            $response = Http::withHeaders(['User-Agent' => $this->userAgent()])->timeout(30)->get(self::API, [
                'action' => 'query',
                'format' => 'json',
                'generator' => 'search',
                'gsrnamespace' => 6,
                'gsrsearch' => "{$query} filetype:bitmap",
                'gsrlimit' => 30,
                'prop' => 'imageinfo',
                'iiprop' => 'url|mime|size|extmetadata',
                'iiurlwidth' => 1200,
            ]);
        } catch (\Throwable $e) {
            $this->command?->warn("  search failed for {$name}: {$e->getMessage()}");
            return [];
        }

        $pages = collect($response->json('query.pages', []))->sortBy('index');

        $candidates = $pages->map(function (array $page) {
            $info = $page['imageinfo'][0] ?? null;
            if (!$info || $info['mime'] !== 'image/jpeg' || ($info['width'] ?? 0) < ($info['height'] ?? 0) * 1.2 || ($info['width'] ?? 0) < 800) {
                return null;
            }

            $title = Str::of($page['title'])->after('File:')->beforeLast('.')->toString();
            // Whole words only — a plain substring check on "toy" would drop every "Toyota".
            $words = implode('|', array_map(fn ($w) => preg_quote($w, '/'), self::SKIP_TITLE_WORDS));
            if (preg_match("/\\b({$words})\\b/i", $title)) {
                return null;
            }

            $meta = $info['extmetadata'] ?? [];

            return [
                'url' => $info['thumburl'] ?? $info['url'],
                'title' => $title,
                'author' => isset($meta['Artist']['value']) ? trim(strip_tags($meta['Artist']['value'])) : null,
                'license' => $meta['LicenseShortName']['value'] ?? null,
                'source' => $info['descriptionurl'] ?? null,
            ];
        })->filter()->values();

        // Prefer files actually named after the model (search also returns its siblings).
        $keyword = Str::lower(Str::of($name)->after(' ')->explode(' ')->first());
        $named = $candidates->filter(fn ($c) => Str::contains(Str::lower($c['title']), $keyword));

        return ($named->count() >= 2 ? $named : $candidates)->take(self::PHOTOS_PER_MODEL)->values()->all();
    }

    private function attach(Vehicle $vehicle, array $photos): void
    {
        $picked = collect($photos)->shuffle()->take(random_int(...self::PHOTOS_PER_VEHICLE))->values();
        $disk = Storage::disk('public');

        foreach ($picked as $i => $path) {
            $attachment = Attachment::create([
                'shop_id' => $vehicle->shop_id,
                'uploaded_by' => $vehicle->created_by,
                'file_name' => Str::slug($vehicle->title) . '-' . ($i + 1) . '.jpg',
                'file_path' => $path,
                'disk' => 'public',
                'mime_type' => 'image/jpeg',
                'file_size' => $disk->size($path),
                'attachable_type' => 'vehicle',
                'attachable_id' => $vehicle->id,
                'visibility' => Attachment::VISIBILITY_PUBLIC,
            ]);

            VehicleImage::create([
                'vehicle_id' => $vehicle->id,
                'attachment_id' => $attachment->id,
                'sort_order' => $i + 1,
                'is_primary' => $i === 0,
                'alt_text' => $vehicle->title,
            ]);
        }
    }

    private function userAgent(): string
    {
        // Wikimedia throttles generic agents harder — name the tool, per
        // https://meta.wikimedia.org/wiki/User-Agent_policy
        return Str::studly(config('app.name', 'Laravel')) . 'DemoSeeder/1.0 (demo data seeding; ' . config('app.url') . ')';
    }
}
