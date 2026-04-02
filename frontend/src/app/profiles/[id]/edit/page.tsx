"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getProfile, updateProfile } from "@/lib/api";
import type { Profile } from "@/types";
import ProfileForm, { ProfileFormData } from "@/components/ProfileForm";

export default function EditProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile(Number(id))
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(data: ProfileFormData) {
    await updateProfile(Number(id), data);
    router.push(`/profiles/${id}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-center text-slate-500 py-24">Profile not found.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/profiles/${id}`} className="btn-secondary px-3 py-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Profile</h1>
          <p className="text-sm text-slate-500">{profile.name}</p>
        </div>
      </div>

      <ProfileForm
        initial={{
          name:             profile.name,
          url:              profile.url,
          contact_number:   profile.contact_number,
          email:            profile.email,
          description:      profile.description,
          gemini_model:     profile.gemini_model,
          image_model:      profile.image_model,
          ig_user_id:       profile.ig_user_id,
          currency:         profile.currency,
          facebook_page_id: profile.facebook_page_id,
        }}
        geminiSet={profile.gemini_api_key_set}
        composioSet={profile.composio_api_key_set}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </div>
  );
}
