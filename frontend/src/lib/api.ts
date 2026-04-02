import axios from "axios";
import type {
  Product, ScrapeResponse, ProcessImageResponse,
  GenerateCaptionResponse, PublishResponse, SettingsResponse,
  TokenResponse, Language, Platform,
  Profile, Pipeline, Post, TrackedProduct,
} from "@/types";

const api = axios.create({
  baseURL: "/api",
  timeout: 120_000,
});

api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>("/auth/login", { email, password });
  return data;
}

export async function registerUser(email: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>("/auth/register", { email, password });
  return data;
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  const { data } = await api.get<Profile[]>("/profiles");
  return data;
}

export async function getProfile(id: number): Promise<Profile> {
  const { data } = await api.get<Profile>(`/profiles/${id}`);
  return data;
}

export async function createProfile(payload: {
  name: string; url: string; contact_number?: string; email?: string;
  description?: string; gemini_api_key?: string; composio_api_key?: string;
}): Promise<Profile> {
  const { data } = await api.post<Profile>("/profiles", payload);
  return data;
}

export async function updateProfile(id: number, payload: Partial<{
  name: string; url: string; contact_number: string; email: string;
  description: string; gemini_api_key: string; composio_api_key: string;
  gemini_model: string; image_model: string; ig_user_id: string; currency: string;
  facebook_page_id: string;
}>): Promise<Profile> {
  // Don't send empty API key strings — backend would overwrite existing keys with ""
  const body = { ...payload };
  if (!body.gemini_api_key)   delete body.gemini_api_key;
  if (!body.composio_api_key) delete body.composio_api_key;
  const { data } = await api.put<Profile>(`/profiles/${id}`, body);
  return data;
}

export async function deleteProfile(id: number): Promise<void> {
  await api.delete(`/profiles/${id}`);
}

// ── Pipelines ─────────────────────────────────────────────────────────────────

export async function getPipelines(profileId: number): Promise<Pipeline[]> {
  const { data } = await api.get<Pipeline[]>(`/profiles/${profileId}/pipelines`);
  return data;
}

export async function createPipeline(profileId: number, payload: {
  name: string; platforms: string[]; languages: string[]; schedule: string; post_time: string;
}): Promise<Pipeline> {
  const { data } = await api.post<Pipeline>(`/profiles/${profileId}/pipelines`, payload);
  return data;
}

export async function updatePipeline(profileId: number, pipelineId: number, payload: Partial<{
  name: string; platforms: string[]; languages: string[]; schedule: string; post_time: string;
  status: string; workflow_configured: boolean; posts_per_run: number;
  caption_prompt: string; image_prompt: string;
}>): Promise<Pipeline> {
  const { data } = await api.put<Pipeline>(
    `/profiles/${profileId}/pipelines/${pipelineId}`, payload
  );
  return data;
}

export async function deletePipeline(profileId: number, pipelineId: number): Promise<void> {
  await api.delete(`/profiles/${profileId}/pipelines/${pipelineId}`);
}

export async function getPipelineStatus(profileId: number, pipelineId: number): Promise<{
  running: boolean; step: string; step_index: number;
}> {
  const { data } = await api.get(`/profiles/${profileId}/pipelines/${pipelineId}/status`);
  return data;
}

export async function runPipeline(profileId: number, pipelineId: number, isTest = false): Promise<Post[]> {
  const { data } = await api.post<Post[]>(
    `/profiles/${profileId}/pipelines/${pipelineId}/run`,
    null,
    { params: { is_test: isTest } }
  );
  return data;
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function getPosts(profileId: number, status?: string): Promise<Post[]> {
  const params = status ? { status } : {};
  const { data } = await api.get<Post[]>(`/profiles/${profileId}/posts`, { params });
  return data;
}

export async function approvePost(postId: number): Promise<PublishResponse> {
  const { data } = await api.patch<PublishResponse>(`/posts/${postId}/approve`);
  return data;
}

export async function rejectPost(postId: number): Promise<void> {
  await api.patch(`/posts/${postId}/reject`);
}

export async function deletePost(postId: number): Promise<void> {
  await api.delete(`/posts/${postId}`);
}

// ── Tracked Products ──────────────────────────────────────────────────────────

export async function getTrackedProducts(profileId: number): Promise<TrackedProduct[]> {
  const { data } = await api.get<TrackedProduct[]>(`/profiles/${profileId}/products`);
  return data;
}

export async function toggleTrackedProduct(
  profileId: number, productId: number, enabled: boolean
): Promise<TrackedProduct> {
  const { data } = await api.patch<TrackedProduct>(
    `/profiles/${profileId}/products/${productId}/toggle`,
    null,
    { params: { enabled } }
  );
  return data;
}

// ── Scraper ───────────────────────────────────────────────────────────────────

export async function scrapeWebsite(
  url: string, phone: string, profileId?: number
): Promise<ScrapeResponse> {
  const { data } = await api.post<ScrapeResponse>("/scrape", {
    url, phone, profile_id: profileId,
  });
  return data;
}

// ── Image Processing ──────────────────────────────────────────────────────────

export async function processImage(
  product: Product, site_theme: string, profileId?: number
): Promise<ProcessImageResponse> {
  const { data } = await api.post<ProcessImageResponse>("/image", {
    product, site_theme, profile_id: profileId,
  });
  return data;
}

// ── Caption ───────────────────────────────────────────────────────────────────

export async function generateCaption(
  product: Product, phone: string, languages: Language[],
  site_theme: string, profileId?: number
): Promise<GenerateCaptionResponse> {
  const { data } = await api.post<GenerateCaptionResponse>("/caption", {
    product, phone, languages, site_theme, profile_id: profileId,
  });
  return data;
}

// ── Publish ───────────────────────────────────────────────────────────────────

export async function publishPost(
  image_filename: string, caption: string, platforms: Platform[],
  profileId?: number, postId?: number
): Promise<PublishResponse> {
  const { data } = await api.post<PublishResponse>("/publish", {
    image_filename, caption, platforms,
    profile_id: profileId, post_id: postId,
  });
  return data;
}

// ── Connections ───────────────────────────────────────────────────────────────

export async function getConnections(profileId: number): Promise<{ facebook: boolean; instagram: boolean }> {
  const { data } = await api.get(`/profiles/${profileId}/connections`);
  return data;
}

export async function initiateConnection(profileId: number, app: "facebook" | "instagram"): Promise<{ app: string; redirect_url: string }> {
  const { data } = await api.post(`/profiles/${profileId}/connections/${app}`);
  return data;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<SettingsResponse> {
  const { data } = await api.get<SettingsResponse>("/settings");
  return data;
}

export async function saveSettings(
  gemini_api_key?: string, composio_api_key?: string
): Promise<SettingsResponse> {
  const { data } = await api.post<SettingsResponse>("/settings", {
    gemini_api_key, composio_api_key,
  });
  return data;
}
