"use client";

import { useQuery } from "@tanstack/react-query";
import { publicService } from "@/services/publicService";
import { platformDetailService } from "@/services/platformDetailService";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { RentLocationsSection } from "./locations/components/RentLocations";
import { BrandsSection } from "./components/BrandsSection";
import { CategoriesSection } from "./components/CategoriesSection";
import { FeaturedVehiclesSection } from "./components/FeaturedVehiclesSection";
import { HeroSection } from "./components/HeroSection";
import { HomeSaleSection } from "./components/HomeSaleSection";
import { HomeHowItWorksSection } from "./components/HomeHowItWorksSection";
import { NewArrivalsSection } from "./components/NewArrivalsSection";
import { OwnerCtaSection } from "./components/OwnerCtaSection";
import { TopShopsSection } from "./components/TopShopsSection";
import { WhyUsSection } from "./components/WhyUsSection";

/** The home page. Data is loaded here because sections share it; each section is its own file in ./components. */
export default function HomePage() {
  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const brandName = brand?.name || "LankaLane";

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  // All active brands — BrandsSection lists the ones with vehicles and tops
  // the preview up with "Coming soon" brands.
  const { data: brands } = useQuery({
    queryKey: ["public-brands"],
    queryFn: () => publicService.brands().then((r) => r.data.data),
  });

  const { data: featured } = useQuery({
    queryKey: ["public-vehicles", "featured"],
    queryFn: () => publicService.vehicles({ sort: "relevance", per_page: 8 }).then((r) => r.data),
  });

  

  const { data: forSale } = useQuery({
    queryKey: ["public-sale-vehicles", "home"],
    queryFn: () => publicService.saleVehicles({ per_page: 4 }).then((r) => r.data),
  });

  // Same catalogue, sorted by published_at instead of relevance — a
  // genuinely different, truthful "New Arrivals" rail rather than a
  // fabricated discount/offer section (the backend has no coupon or
  // discount model at all — see PublicVehicleQuery::search()).
  const { data: newest } = useQuery({
    queryKey: ["public-vehicles", "newest"],
    queryFn: () => publicService.vehicles({ sort: "newest", per_page: 8 }).then((r) => r.data.data),
  });

  const { data: cities } = useQuery({
    queryKey: ["public-locations"],
    queryFn: () => publicService.locations().then((r) => r.data.data),
  });

  const { data: allDistricts } = useQuery({
    queryKey: ["public-districts"],
    queryFn: () => publicService.districts().then((r) => r.data.data),
    staleTime: Infinity,
  });

  // Top rated first (the directory's default sort) — the first three become
  // the spotlight cards, the rest feed the logo marquee.
  const { data: shopsRes } = useQuery({
    queryKey: ["public-shops", "teaser"],
    queryFn: () => publicService.shops({ per_page: 24 }).then((r) => r.data),
  });
  const shops = shopsRes?.data ?? [];

  // Platform-managed hero slides (/platform/hero-slides); empty → the
  // slideshow falls back to vehicle/stock photos and the default headline.
  const { data: heroSlides } = useQuery({
    queryKey: ["public-hero-slides"],
    queryFn: () => publicService.heroSlides().then((r) => r.data.data),
    staleTime: 60_000,
  });

  return (
    <div>
      <HeroSection featured={featured} saleTotal={forSale?.meta?.total} heroSlides={heroSlides} categories={categories} allDistricts={allDistricts} shopsTotal={shopsRes?.meta?.total} />

      {categories?.length > 0 && (
        <ScrollReveal>
          <CategoriesSection categories={categories} />
        </ScrollReveal>
      )}

      <ScrollReveal>
        <FeaturedVehiclesSection featured={featured} />
      </ScrollReveal>

      {forSale?.data?.length > 0 && (
        <ScrollReveal>
          <HomeSaleSection vehicles={forSale.data} />
        </ScrollReveal>
      )}

      {newest?.length > 0 && (
        <ScrollReveal>
          <NewArrivalsSection newest={newest} />
        </ScrollReveal>
      )}

      {shops.length > 0 && (
        <ScrollReveal>
          <TopShopsSection shops={shops} />
        </ScrollReveal>
      )}

      {(cities?.length > 0 || allDistricts?.length > 0) && (
        <ScrollReveal>
          <RentLocationsSection cities={cities} districts={allDistricts} />
        </ScrollReveal>
      )}

      {brands?.some((b) => b.vehicles_count > 0) && (
        <ScrollReveal>
          <BrandsSection brands={brands} />
        </ScrollReveal>
      )}

      <ScrollReveal>
        <WhyUsSection brandName={brandName} />
      </ScrollReveal>

      <ScrollReveal>
        <HomeHowItWorksSection />
      </ScrollReveal>

      <ScrollReveal>
        <OwnerCtaSection brandName={brandName} />
      </ScrollReveal>
    </div>
  );
}
