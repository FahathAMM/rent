"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Home, Loader2, PenLine, ScrollText, Sparkles } from "lucide-react";
import { vendorService } from "@/services/vendorService";
import { useAuthStore } from "@/store/authStore";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RichTextEditor } from "./components/RichTextEditor";

const SAMPLE = `<h2>Rental terms</h2><ol>
<li><p>The renter must be at least <strong>21 years old</strong> and hold a valid driving licence.</p></li>
<li><p>The vehicle is to be returned on the agreed date and time, with the <strong>same fuel level</strong> as at pickup.</p></li>
<li><p>Smoking and pets are not allowed in the vehicle.</p></li>
<li><p>The renter is responsible for traffic fines and parking charges during the rental.</p></li>
<li><p>Any damage during the rental may be deducted from the <strong>security deposit</strong>.</p></li>
<li><p>The vehicle may not be taken outside Sri Lanka or used for racing or towing.</p></li>
</ol>`.replace(/\n/g, "");

/** The shop's own terms & conditions — the customer reads and signs them on screen at handover. */
export default function VendorTermsPage() {
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.can("vendor-settings-terms-edit"));
  const [terms, setTerms] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-terms"],
    queryFn: () => vendorService.terms.get().then((r) => r.data.data),
  });
  useEffect(() => {
    if (data) setTerms(data.terms ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () => vendorService.terms.update(terms),
    onSuccess: (res) => {
      toast.success(res.data.message ?? "Saved");
      qc.invalidateQueries({ queryKey: ["vendor-terms"] });
    },
    onError: (err) => toast.error(err.response?.data?.errors?.terms?.[0] ?? err.response?.data?.message ?? "Could not save"),
  });

  const breadcrumb = [
    { label: "Dashboard", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Settings" },
    { label: "Terms & Conditions" },
  ];
  const changed = data && terms !== (data.terms ?? "");

  return (
    <PageWrapper breadcrumb={breadcrumb}>
      <PageHeader
        title="Terms & Conditions"
        description="Your own rental terms. At handover the customer reads them on your screen, agrees and signs with a finger — the signed copy is kept with the booking and printed on the rental agreement."
      />

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><PenLine className="h-4 w-4" /> Your terms</span>
                {canEdit && !terms && (
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setTerms(SAMPLE)}>
                    <Sparkles className="h-3.5 w-3.5" /> Start from a sample
                  </Button>
                )}
              </CardTitle>
              <CardDescription>Use headings and numbered lists to keep them easy to read. Leave empty if you don&apos;t want customers to sign anything at handover.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <RichTextEditor
                value={terms}
                onChange={setTerms}
                disabled={!canEdit}
                placeholder="Write your rental terms — use headings and lists to keep them easy to read…"
              />
              <div className="flex items-center justify-end">
                {canEdit ? (
                  <Button onClick={() => save.mutate()} disabled={save.isPending || !changed}>
                    {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save terms
                  </Button>
                ) : <span className="text-xs text-muted-foreground">You can view these terms; only someone with edit access can change them.</span>}
              </div>
              <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                Changing your terms only affects future handovers — agreements already signed keep the exact text the customer signed.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4" /> What the customer sees at handover</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 rounded-lg border p-3">
                <p className="flex items-center gap-2 text-sm font-medium"><ScrollText className="h-4 w-4" /> Terms & conditions — the customer reads and signs</p>
                {terms ? (
                  <div className="rich-text max-h-72 overflow-y-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: terms }} />
                ) : (
                  <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">No terms — the handover won&apos;t ask for a signature.</p>
                )}
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed bg-white text-sm text-slate-400">Customer signs here</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageWrapper>
  );
}
