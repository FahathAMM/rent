"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  platformCompanyService,
  platformPlanService,
} from "@/services/platformService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { TextInput, PasswordInput, ValidationError } from "@/components/forms/FormField";
import { Fieldset } from "@/components/forms/Fieldset";
import { SelectInput } from "@/components/forms/SelectInput";
import { Home } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_FORM = {
  company_name: "",
  trn: "",
  city: "",
  emirate: "",
  name: "",
  owner_email: "",
  owner_phone: "",
  password: "",
  password_confirmation: "",
  plan_id: "",
  subscription_status: "trial",
};

export default function NewPlatformCompanyPage() {
  const router = useRouter();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});

  const { data: plans } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => platformPlanService.getAll().then((r) => r.data.data),
  });

  const create = useMutation({
    mutationFn: platformCompanyService.create,
    onSuccess: (res) => {
      toast.success(res.data.message ?? "Company created");
      router.push(`/platform/companies/${res.data.data.id}`);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    create.mutate({ ...form, plan_id: form.plan_id || undefined });
  };

  const breadcrumbItems = [
    {
      label: "Dashboard",
      href: "/platform/dashboard",
      icon: <Home className="size-4" />,
    },
    { label: "Companies", href: "/platform/companies" },
    { label: "New Company" },
  ];

  return (
    <div>
      <PageWrapper childMaxWidth="max-w-4xl" breadcrumb={breadcrumbItems}>
        <PageHeader
          title="New Company"
          description="Onboard a company directly, bypassing public self-signup."
        />

        <form onSubmit={handleSubmit} className="grid gap-5">
          <ValidationError errors={errors} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Fieldset legend="Company Details">
              <TextInput
                label="Company Name"
                value={form.company_name}
                onChange={fi("company_name")}
                error={errors.company_name?.[0]}
                required
                className="col-span-2"
              />
              <TextInput
                label="TRN"
                value={form.trn}
                onChange={fi("trn")}
                error={errors.trn?.[0]}
              />
              <TextInput
                label="City"
                value={form.city}
                onChange={fi("city")}
                error={errors.city?.[0]}
              />
              <TextInput
                label="Emirate"
                value={form.emirate}
                onChange={fi("emirate")}
                error={errors.emirate?.[0]}
              />
            </Fieldset>

            <Fieldset legend="Owner Account">
              <TextInput
                label="Owner Name"
                value={form.name}
                onChange={fi("name")}
                error={errors.name?.[0]}
                required
                className="col-span-2"
              />
              <TextInput
                label="Owner Email"
                type="email"
                value={form.owner_email}
                onChange={fi("owner_email")}
                error={errors.owner_email?.[0]}
                required
                className="col-span-2"
              />
              <TextInput
                label="Owner Phone"
                value={form.owner_phone}
                onChange={fi("owner_phone")}
                error={errors.owner_phone?.[0]}
              />
              <div />
              <PasswordInput
                label="Password"
                value={form.password}
                onChange={fi("password")}
                error={errors.password?.[0]}
                required
              />
              <PasswordInput
                label="Confirm Password"
                value={form.password_confirmation}
                onChange={fi("password_confirmation")}
              />
            </Fieldset>

            <Fieldset legend="Subscription">
              <SelectInput
                label="Plan"
                value={form.plan_id}
                onChange={f("plan_id")}
                placeholder="Default (lowest-tier plan)"
                options={(plans ?? []).map((p) => ({
                  value: String(p.id),
                  label: p.name,
                }))}
              />
              <SelectInput
                label="Status"
                value={form.subscription_status}
                onChange={f("subscription_status")}
                options={[
                  { value: "trial", label: "Trial" },
                  { value: "active", label: "Active" },
                ]}
              />
            </Fieldset>
          </div>
           <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/platform/companies")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating..." : "Create Company"}
              </Button>
            </div>
        </form>
      </PageWrapper>
    </div>
  );
}
