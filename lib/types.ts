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
  sort_order: number;
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
};

export type LegalPage = {
  id: string;
  slug: "terms" | "privacy" | "refund" | "shipping" | "grievance";
  title: string;
  content: string;
  updated_at: string;
};

export type Order = {
  id: string;
  razorpay_order_id: string;
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
  status: "created" | "paid" | "failed";
  created_at: string;
};

export type Department = "admin" | "sales" | "stores" | "purchase" | "top_management" | "other";

export type StaffProfile = {
  id: string;
  full_name: string;
  email?: string;
  department: Department;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
};

export type Resource =
  | "hero_content" | "leaders" | "verticals" | "gallery_items" | "products"
  | "orders" | "legal_pages" | "company_info" | "compliance_records"
  | "customers" | "vendors" | "inventory_items" | "warehouses"
  | "stock_transactions" | "employees";

export type PermissionSet = { create: boolean; read: boolean; update: boolean; delete: boolean };
export type PermissionsMap = Record<Resource, PermissionSet>;

export type ComplianceCategory =
  | "gst" | "udyam" | "trademark" | "employee_welfare"
  | "pollution_control" | "local_body_license" | "invoicing" | "other";

export type ComplianceRecord = {
  id: string;
  category: ComplianceCategory;
  title: string;
  reference_number?: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date?: string;
  document_url?: string;
  notes?: string;
  reminder_days_before: number;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  billing_address?: string;
  shipping_address?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
};

export type Vendor = {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
};

export type ItemType = "raw_material" | "finished_good" | "trading" | "service";

export type InventoryItem = {
  id: string;
  item_code: string;
  name: string;
  item_type: ItemType;
  category?: string;
  unit_of_measure: string;
  hsn_code?: string;
  standard_cost: number;
  selling_price: number;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
};

export type Warehouse = {
  id: string;
  name: string;
  address?: string;
  is_active: boolean;
  created_at: string;
};

export type StockTransactionType =
  | "opening" | "purchase_receipt" | "sales_dispatch"
  | "production_consumption" | "production_output" | "adjustment";

export type StockTransaction = {
  id: string;
  item_id: string;
  warehouse_id: string;
  transaction_type: StockTransactionType;
  quantity: number;
  unit_cost?: number;
  reference_note?: string;
  transaction_date: string;
  created_at: string;
};

export type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  department?: string;
  designation?: string;
  email?: string;
  phone?: string;
  date_of_joining?: string;
  pf_number?: string;
  is_active: boolean;
  created_at: string;
};
