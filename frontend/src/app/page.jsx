"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { Search, Car, User as UserIcon } from "lucide-react";
import { VehicleCard } from "@/components/marketplace/VehicleCard";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [q, setQ] = useState("");
  const [authView, setAuthView] = useState(null); // "login" | "register" | null

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  const { data: featured } = useQuery({
    queryKey: ["public-vehicles", "featured"],
    queryFn: () => publicService.vehicles({ sort: "relevance", per_page: 8 }).then((r) => r.data.data),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Car className="size-4" />
            </div>
            RentLanka
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/search">Browse</Link>
            </Button>
            {isAuthenticated ? (
              <Button asChild>
                <Link href="/account">
                  <UserIcon className="mr-2 h-4 w-4" /> {user?.name?.split(" ")[0] ?? "My Account"}
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAuthView("login")}>Sign in</Button>
                <Button onClick={() => setAuthView("register")}>Sign up</Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <AuthDialog
        open={!!authView}
        onOpenChange={(v) => !v && setAuthView(null)}
        initialView={authView ?? "login"}
      />

      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Rent any vehicle, anywhere in Sri Lanka
          </h1>
          <p className="mt-3 text-muted-foreground">
            Cars, vans and more from independent owners and trusted rental shops.
          </p>
          <form onSubmit={handleSearch} className="mx-auto mt-6 flex max-w-xl gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by make, model or city..."
              className="h-11"
            />
            <Button type="submit" size="lg" className="shrink-0">
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </form>
        </div>
      </section>

      {categories?.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <h2 className="mb-4 text-lg font-semibold">Browse by category</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/search?category_id=${c.id}`}
                className="flex shrink-0 flex-col items-center gap-2 rounded-xl border bg-card px-5 py-4 text-center transition-colors hover:bg-muted"
              >
                <Car className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium whitespace-nowrap">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Featured vehicles</h2>
          <Link href="/search" className="text-sm text-primary hover:underline">View all →</Link>
        </div>
        {featured?.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
            No vehicles published yet — check back soon.
          </p>
        )}
      </section>
    </div>
  );
}
