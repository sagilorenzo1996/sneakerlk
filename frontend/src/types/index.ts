export interface Product {
  name: string;
  price: string;
  product_url: string;
  image_url: string;
  description: string;
}

export interface ScrapeResponse {
  products: Product[];
  site_theme: string;
  site_title: string;
}

export interface ProcessImageResponse {
  composite_image_url: string;
  image_filename: string;
}

export interface GenerateCaptionResponse {
  caption: string;
}

export interface PublishResponse {
  success: boolean;
  message: string;
  results: Record<string, unknown>;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  email: string;
}

export interface SettingsResponse {
  gemini_api_key_set: boolean;
  composio_api_key_set: boolean;
  message: string;
}

export interface Profile {
  id: number;
  user_id: number;
  name: string;
  url: string;
  contact_number: string;
  email: string;
  description: string;
  gemini_api_key_set: boolean;
  composio_api_key_set: boolean;
  gemini_model: string;
  image_model: string;
  ig_user_id: string;
  facebook_page_id: string;
  currency: string;
  created_at: string;
  post_counts: Record<string, number>;
  usage: Record<string, number>;
  pipeline_count: number;
}

export interface Pipeline {
  id: number;
  profile_id: number;
  name: string;
  platforms: string[];
  languages: string[];
  schedule: string;
  post_time: string;
  status: string;
  workflow_configured: boolean;
  workflow_type: string;
  posts_per_run: number;
  caption_prompt: string;
  image_prompt: string;
  reference_images: string[];
  created_at: string;
}

export interface Post {
  id: number;
  profile_id: number;
  pipeline_id: number | null;
  product_name: string;
  product_url: string;
  product_description: string;
  image_filename: string;
  image_url: string;
  caption: string;
  platforms: string[];
  status: string;
  caption_prompt_used: string;
  image_prompt_used: string;
  posted_at: string | null;
  created_at: string;
}

export type Language =
  | "English"
  | "Arabic"
  | "French"
  | "Spanish"
  | "Hindi"
  | "Portuguese"
  | "German"
  | "Turkish";

export type Platform = "facebook" | "instagram";

export interface TrackedProduct {
  id: number;
  profile_id: number;
  name: string;
  product_url: string;
  image_url: string;
  description: string;
  enabled: boolean;
  created_at: string;
}

export type Step =
  | "input"
  | "products"
  | "processing"
  | "preview"
  | "published";
