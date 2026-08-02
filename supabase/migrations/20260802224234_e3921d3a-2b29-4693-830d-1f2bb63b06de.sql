
CREATE TYPE public.stock_movement_type AS ENUM ('in','out','adjustment','sale','return');

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_members_all ON public.categories FOR ALL TO authenticated
  USING (public.is_store_member(store_id, auth.uid()))
  WITH CHECK (public.is_store_member(store_id, auth.uid()));

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  value text NOT NULL,
  sku text,
  barcode text,
  price numeric,
  stock integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_variants_members_all ON public.product_variants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND public.is_store_member(p.store_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND public.is_store_member(p.store_id, auth.uid())));

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  type public.stock_movement_type NOT NULL DEFAULT 'adjustment',
  quantity integer NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_movements_members_all ON public.stock_movements FOR ALL TO authenticated
  USING (public.is_store_member(store_id, auth.uid()))
  WITH CHECK (public.is_store_member(store_id, auth.uid()));

ALTER TABLE public.products
  ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN barcode text,
  ADD COLUMN unit text NOT NULL DEFAULT 'unité';

CREATE INDEX idx_categories_store ON public.categories(store_id);
CREATE INDEX idx_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_movements_store ON public.stock_movements(store_id, created_at DESC);
CREATE INDEX idx_products_category ON public.products(category_id);

CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_variants_updated BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
