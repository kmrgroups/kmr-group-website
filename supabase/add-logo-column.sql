-- Adds the company logo field. Safe to run even if you already ran the
-- full schema — "if not exists" means it won't error on a re-run.
alter table company_info add column if not exists logo_url text;
