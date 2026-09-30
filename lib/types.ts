export type CompanyInfo = {
  id: string;
  legal_name: string;
  brand_name: string;
  logo_url?: string;
  founded_year: number;
  gstin: string;
  cin: string;
  registered_address: string;
  email: string;
  phone: string;
  map_lat: number;
  map_lng: number;
  facebook_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  youtube_url?: string;
  twitter_url?: string;
  whatsapp_number?: string;
  trade_name?: string;
  constitution?: string;
  proprietor_name?: string;
  proprietor_title?: string;
  udyam_number?: string;
  msme_category?: string;
  trademark_status?: string;
  website_url?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  tagline?: string;
  slogan?: string;
  short_about?: string;
  vision?: string;
  mission?: string;
  logo_full_url?: string;
  letterhead_url?: string;
  founder_name?: string;
  founder_title?: string;
  founder_photo_url?: string;
  founder_message?: string;
  founder_signature_url?: string;
  about_story?: string;
  core_values?: string;
  business_hours?: string;
  map_embed_url?: string;
  careers_email?: string;
  alt_phone?: string;
  about_image_url?: string;
};

export type SiteSettings = {
  online_payment: boolean;
  bank_transfer: boolean;
  announcement?: string | null;
  announcement_link?: string | null;
  header_cta_label?: string | null;
  header_cta_link?: string | null;
};

export type HeroSlide = {
  id: string; eyebrow?: string; title: string; subtitle?: string; image_url?: string;
  cta_label?: string; cta_link?: string; cta2_label?: string; cta2_link?: string; sort_order: number;
};
export type SiteStat = { id: string; value: string; label: string };

export type JobOpening = {
  id: string; title: string; department?: string; location?: string; employment_type?: string; experience?: string; salary_range?: string;
  summary?: string; description?: string; requirements?: string; posted_on: string; closes_on?: string;
};

export type HeroContent = {
  id: string;
  headline: string;
  subheadline: string;
  banner_image_url: string;
  cta_label: string;
  cta_link: string;
};

export type Leader = {
  id: string;
  name: string;
  designation: string;
  bio: string;
  photo_url: string;
  linkedin_url?: string;
  sort_order: number;
};

export type Vertical = {
  id: string;
  title: string;
  code: string;
  description: string;
  icon_url?: string;
  image_url?: string;
  sort_order: number;
  slug?: string;
  link?: string;
  is_active?: boolean;
};

export type GalleryItem = {
  id: string;
  title: string;
  media_type: "photo" | "video";
  media_url: string;
  thumbnail_url?: string;
  sort_order: number;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  price: number;
  mrp?: number;
  stock_quantity: number;
  image_url: string;
  is_active: boolean;
  created_at: string;
  business?: "shop" | "software" | "training" | "import_export" | "trading" | "distribution";
  kind?: "goods" | "course" | "service";
  featured?: boolean;
  sort_order?: number;
  unit?: string;
  hsn_code?: string;
  enquiry_only?: boolean;
  details?: Record<string, string>;
};

export type LegalPage = {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary?: string;
  show_in_footer?: boolean;
  sort_order?: number;
  updated_at: string;
};

export type Order = {
  id: string;
  order_no?: string;
  razorpay_order_id?: string;   // only on old orders placed through Razorpay
  razorpay_payment_id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  amount: number;
  currency: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  shipping_address: string;
  status: "created" | "awaiting_payment" | "payment_reported" | "paid" | "cancelled" | "failed";
  pay_method?: string;
  pay_reference?: string;
  paid_on?: string;
  paid_amount?: number;
  payer_name?: string;
  reported_at?: string;
  confirmed_at?: string;
  confirmed_by?: string;
  reject_reason?: string;
  admin_note?: string;
  created_at: string;
};

