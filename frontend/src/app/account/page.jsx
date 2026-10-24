"use client";

import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Heart, Search, Car, UserPlus, Store, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AccountDashboardPage() {
  const { user, isVendor } = useAuthStore();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Welcome, {user?.name?.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Find a vehicle, track your bookings, and manage your account.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center sm:flex-row sm:text-left sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Looking for a vehicle?</p>
              <p className="text-sm text-muted-foreground">Browse cars, vans and more from verified owners across Sri Lanka.</p>
            </div>
          </div>
          <Button asChild>
            <Link href="/browse">
              <Car className="mr-2 h-4 w-4" /> Browse vehicles
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">My Bookings</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Link href="/account/bookings" className="text-primary hover:underline">View your bookings →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Heart className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Favorites</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Link href="/account/favorites" className="text-primary hover:underline">View saved vehicles →</Link>
          </CardContent>
        </Card>
      </div>

      {isVendor() ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-5">
            <div>
              <p className="font-semibold">You have a vendor account</p>
              <p className="text-sm text-muted-foreground">Manage your vehicles, bookings and earnings from your vendor dashboard.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/vendor/dashboard">Go to vendor dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">List your own vehicles</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col gap-3 py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2.5"><UserPlus className="h-5 w-5 text-primary" /></div>
                  <p className="font-semibold">Become a Vehicle Owner</p>
                </div>
                <p className="text-sm text-muted-foreground">List your own car or bike individually and start earning.</p>
                <Button asChild variant="outline" className="w-fit">
                  <Link href="/account/become-owner">Get started <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-3 py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2.5"><Store className="h-5 w-5 text-primary" /></div>
                  <p className="font-semibold">Register a Rental Shop</p>
                </div>
                <p className="text-sm text-muted-foreground">Run a business with multiple vehicles and staff? Register your shop.</p>
                <Button asChild variant="outline" className="w-fit">
                  <Link href="/account/shops/new">Get started <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
