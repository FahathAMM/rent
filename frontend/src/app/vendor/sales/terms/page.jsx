"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Loader2, PenLine, Sparkles } from "lucide-react";
import { vendorService } from "@/services/vendorService";
import { useAuthStore } from "@/store/authStore";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { toast } from "sonner";

const SAMPLE = `<h2>Sale terms</h2><ol>
<li><p>The vehicle is sold <strong>as seen</strong>, unless a warranty is written on this agreement.</p></li>
<li><p>The buyer has inspected the vehicle and is satisfied with its condition.</p></li>
<li><p>Ownership passes to the buyer once the full price is paid.</p></li>
<li><p>The buyer is responsible for transferring the registration into their name.</p></li>
</ol>`.replace(/\n/g, "");

/** The shop's sale terms — the buyer reads and signs them on screen when the sale is recorded. */
export default function SaleTermsPage() {
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.can("vendor-sales-terms-edit"));
  const [terms, setTerms] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-sale-terms"],
    queryFn: () => vendorService.sales.terms.get().then((r) => r.data.data.terms),
  });
  useEffect(() => {
    if (data !== undefined) setTerms(data ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () => vendorService.sales.terms.update(terms),
    onSuccess: (res) => {
      toast.success(res.data.message ?? "Saved");
      qc.invalidateQueries({ queryKey: ["vendor-sale-terms"] });
    },
    onError: (err) => toast.error(err.response?.data?.errors?.terms?.[0] ?? err.response?.data?.message ?? "Could not save"),
  });

  const breadcrumb = [
    { label: "Dashboard", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Sales" },
    { label: "Sale Terms" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumb}>
      <PageHeader
        title="Sale Terms"
        description="Your own sale terms, separate from your rental terms. When you record a sale the buyer reads them on your screen and signs. The signed copy is printed on the sale agreement."
      />

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card className="max-w-3xl rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><PenLine className="h-4 w-4" /> Your terms</span>
              {canEdit && !terms && (
                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setTerms(SAMPLE)}>
                  <Sparkles className="h-3.5 w-3.5" /> Start from a sample
                </Button>
              )}
            </CardTitle>
            <CardDescription>Leave empty if you don&apos;t want buyers to sign anything. Changes only affect future sales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RichTextEditor value={terms} onChange={setTerms} disabled={!canEdit} placeholder="Write your sale terms: sold as seen, warranty…" />
            <div className="flex items-center justify-end">
              {canEdit ? (
                <Button onClick={() => save.mutate()} disabled={save.isPending || terms === (data ?? "")}>
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save terms
                </Button>
              ) : <span className="text-xs text-muted-foreground">Only someone with edit access can change these terms.</span>}
            </div>
          </CardContent>
        </Card>
      )}
    </PageWrapper>
  );
}
