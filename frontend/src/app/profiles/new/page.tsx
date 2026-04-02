"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createProfile } from "@/lib/api";
import ProfileForm, { ProfileFormData } from "@/components/ProfileForm";

export default function NewProfilePage() {
  const router = useRouter();

  async function handleSubmit(data: ProfileFormData) {
    await createProfile(data);
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="btn-secondary px-3 py-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Profile</h1>
          <p className="text-sm text-slate-500">Add a new store to manage</p>
        </div>
      </div>

      <ProfileForm onSubmit={handleSubmit} submitLabel="Create Profile" />
    </div>
  );
}
