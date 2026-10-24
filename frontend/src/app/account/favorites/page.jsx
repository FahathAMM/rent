import { Heart } from "lucide-react";

export default function FavoritesPage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Favorites</h1>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
        <div className="rounded-full bg-muted p-4">
          <Heart className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Coming soon</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Saving vehicles lands in a later phase — the favorites table already exists on the
          backend, but its endpoints aren&apos;t built yet.
        </p>
      </div>
    </div>
  );
}
