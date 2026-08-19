import type { Resource } from "./types";

export const RESOURCES: { key: Resource; label: string }[] = [
  { key: "hero_content", label: "Hero Banner" },
  { key: "leaders", label: "Leadership" },
  { key: "verticals", label: "Verticals" },
  { key: "gallery_items", label: "Gallery" },
  { key: "products", label: "Products" },
  { key: "orders", label: "Orders" },
  { key: "legal_pages", label: "Legal Pages" },
  { key: "company_info", label: "Company Info" },
  { key: "compliance_records", label: "Finance & Compliance" },
  { key: "customers", label: "Customers" },
  { key: "vendors", label: "Vendors" },
  { key: "inventory_items", label: "Items Master" },
  { key: "warehouses", label: "Warehouses" },
  { key: "stock_transactions", label: "Stock Ledger" },
  { key: "employees", label: "Employees" }
];

export const DEPARTMENTS: { key: string; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "sales", label: "Sales" },
  { key: "stores", label: "Stores" },
  { key: "purchase", label: "Purchase" },
  { key: "top_management", label: "Top Management" },
  { key: "other", label: "Other" }
];

export const COMPLIANCE_CATEGORIES: { key: string; label: string }[] = [
  { key: "gst", label: "GST" },
  { key: "udyam", label: "Udyam Registration" },
  { key: "trademark", label: "Trademark" },
  { key: "employee_welfare", label: "Employee Welfare" },
  { key: "pollution_control", label: "Pollution Control" },
  { key: "local_body_license", label: "Local Body License" },
  { key: "invoicing", label: "Invoicing" },
  { key: "other", label: "Other" }
];

export function emptyPermissionSet() {
  return { create: false, read: false, update: false, delete: false };
}
