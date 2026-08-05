-- ============ 1. Product publication status ============
DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status public.product_status NOT NULL DEFAULT 'published';

UPDATE public.products SET status = 'draft' WHERE is_active = false;

-- ============ 2. Store public settings ============
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS show_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_note text;

-- slug backfill + uniqueness
UPDATE public.stores s SET slug = t.new_slug
FROM (
  SELECT id,
    regexp_replace(
      regexp_replace(lower(coalesce(nullif(trim(slug), ''), unaccent_fallback.name)), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    ) || '-' || substr(replace(id::text, '-', ''), 1, 6) AS new_slug
  FROM public.stores unaccent_fallback
) t
WHERE s.id = t.id AND (s.slug IS NULL OR trim(s.slug) = '');

CREATE UNIQUE INDEX IF NOT EXISTS stores_slug_uidx ON public.stores (slug) WHERE slug IS NOT NULL;

-- ============ 3. Shipping options ============
CREATE TABLE IF NOT EXISTS public.shipping_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_options TO authenticated;
GRANT ALL ON public.shipping_options TO service_role;
ALTER TABLE public.shipping_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shipping_options_members_all ON public.shipping_options;
CREATE POLICY shipping_options_members_all ON public.shipping_options FOR ALL TO authenticated
  USING (private.is_store_member(store_id, auth.uid()))
  WITH CHECK (private.is_store_member(store_id, auth.uid()));
DROP TRIGGER IF EXISTS trg_shipping_options_updated ON public.shipping_options;
CREATE TRIGGER trg_shipping_options_updated BEFORE UPDATE ON public.shipping_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 4. Order public fields ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS shipping_option_id uuid REFERENCES public.shipping_options(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_label text,
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_district text;

-- ============ 5. Public read-only views (no internal columns) ============
DROP VIEW IF EXISTS public.shop_variants;
DROP VIEW IF EXISTS public.shop_products;
DROP VIEW IF EXISTS public.shop_categories;
DROP VIEW IF EXISTS public.shop_shipping_options;
DROP VIEW IF EXISTS public.shop_stores;

CREATE VIEW public.shop_stores AS
  SELECT s.id, s.name, s.slug, s.description, s.logo_url, s.currency, s.country,
         s.phone, s.whatsapp_number, s.address, s.show_stock, s.shipping_note
  FROM public.stores s
  WHERE s.is_active = true AND s.slug IS NOT NULL;

CREATE VIEW public.shop_categories AS
  SELECT c.id, c.store_id, c.name, c.description
  FROM public.categories c
  JOIN public.stores s ON s.id = c.store_id
  WHERE s.is_active = true;

CREATE VIEW public.shop_products AS
  SELECT p.id, p.store_id, p.category_id, p.name, p.description, p.price, p.compare_at_price,
         p.image_url, p.unit,
         (p.stock > 0) AS in_stock,
         CASE WHEN s.show_stock THEN p.stock ELSE NULL END AS available_stock
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE s.is_active = true AND p.is_active = true AND p.status = 'published';

CREATE VIEW public.shop_variants AS
  SELECT v.id, v.product_id, p.store_id, v.name, v.value,
         COALESCE(v.price, p.price) AS price,
         (v.stock > 0) AS in_stock,
         CASE WHEN s.show_stock THEN v.stock ELSE NULL END AS available_stock
  FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
  JOIN public.stores s ON s.id = p.store_id
  WHERE s.is_active = true AND p.is_active = true AND p.status = 'published' AND v.is_active = true;

CREATE VIEW public.shop_shipping_options AS
  SELECT o.id, o.store_id, o.name, o.price, o.sort_order
  FROM public.shipping_options o
  JOIN public.stores s ON s.id = o.store_id
  WHERE s.is_active = true AND o.is_active = true;

GRANT SELECT ON public.shop_stores, public.shop_categories, public.shop_products,
  public.shop_variants, public.shop_shipping_options TO anon, authenticated;

-- ============ 6. Shared order core (same engine for dashboard + public) ============
CREATE OR REPLACE FUNCTION private.create_order_core(
  p_store_id uuid,
  p_created_by uuid,
  p_items jsonb,
  p_customer_id uuid,
  p_channel text,
  p_payment_status text,
  p_payment_method text,
  p_shipping numeric,
  p_discount numeric,
  p_notes text,
  p_idempotency_key text,
  p_require_published boolean DEFAULT false,
  p_shipping_option_id uuid DEFAULT NULL,
  p_shipping_label text DEFAULT NULL,
  p_shipping_address text DEFAULT NULL,
  p_shipping_city text DEFAULT NULL,
  p_shipping_district text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_variant public.product_variants%ROWTYPE;
  v_qty integer;
  v_price numeric;
  v_name text;
  v_stock integer;
  v_subtotal numeric := 0;
  v_total numeric;
  v_order_id uuid;
  v_order_number text;
  v_token uuid;
  v_year integer := EXTRACT(YEAR FROM now())::int;
  v_seq integer;
  v_existing public.orders%ROWTYPE;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.orders
      WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number,
        'total', v_existing.total, 'public_token', v_existing.public_token, 'duplicate', true);
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La commande doit contenir au moins un article';
  END IF;
  IF COALESCE(p_shipping, 0) < 0 THEN RAISE EXCEPTION 'Frais de livraison négatifs'; END IF;
  IF COALESCE(p_discount, 0) < 0 THEN RAISE EXCEPTION 'Remise négative'; END IF;

  INSERT INTO public.order_counters (store_id, year, last_number)
    VALUES (p_store_id, v_year, 1)
  ON CONFLICT (store_id, year) DO UPDATE SET last_number = public.order_counters.last_number + 1
  RETURNING last_number INTO v_seq;

  v_order_number := 'KS-' || v_year || '-' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.orders (store_id, customer_id, order_number, status, payment_status,
      payment_method, channel, subtotal, shipping, discount, total, notes, created_by,
      idempotency_key, stock_deducted, shipping_option_id, shipping_label,
      shipping_address, shipping_city, shipping_district)
  VALUES (p_store_id, p_customer_id, v_order_number, 'pending',
      COALESCE(p_payment_status, 'unpaid')::public.payment_status,
      NULLIF(p_payment_method, '')::public.payment_method,
      COALESCE(p_channel, 'whatsapp')::public.order_channel,
      0, COALESCE(p_shipping, 0), COALESCE(p_discount, 0), 0, NULLIF(p_notes, ''), p_created_by,
      p_idempotency_key, true, p_shipping_option_id, NULLIF(p_shipping_label, ''),
      NULLIF(p_shipping_address, ''), NULLIF(p_shipping_city, ''), NULLIF(p_shipping_district, ''))
  RETURNING id, public_token INTO v_order_id, v_token;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantité invalide'; END IF;

    SELECT * INTO v_product FROM public.products
      WHERE id = (v_item->>'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
    IF v_product.store_id <> p_store_id THEN
      RAISE EXCEPTION 'Le produit % n''appartient pas à cette boutique', v_product.name;
    END IF;
    IF p_require_published AND (v_product.status <> 'published' OR NOT v_product.is_active) THEN
      RAISE EXCEPTION 'Le produit % n''est plus disponible', v_product.name;
    END IF;

    IF COALESCE(v_item->>'variant_id', '') <> '' THEN
      SELECT * INTO v_variant FROM public.product_variants
        WHERE id = (v_item->>'variant_id')::uuid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variante introuvable'; END IF;
      IF v_variant.product_id <> v_product.id THEN
        RAISE EXCEPTION 'La variante ne correspond pas au produit %', v_product.name;
      END IF;
      IF p_require_published AND NOT v_variant.is_active THEN
        RAISE EXCEPTION 'Cette variante n''est plus disponible';
      END IF;
      v_name := v_product.name || ' — ' || v_variant.name || ': ' || v_variant.value;
      v_price := COALESCE(v_variant.price, v_product.price);
      v_stock := v_variant.stock;
      IF v_stock < v_qty THEN
        RAISE EXCEPTION 'Stock insuffisant pour %. Disponible : %', v_name, v_stock;
      END IF;
      UPDATE public.product_variants SET stock = stock - v_qty WHERE id = v_variant.id;
    ELSE
      v_variant := NULL;
      v_name := v_product.name;
      v_price := v_product.price;
      v_stock := v_product.stock;
      IF v_stock < v_qty THEN
        RAISE EXCEPTION 'Stock insuffisant pour %. Disponible : %', v_name, v_stock;
      END IF;
      UPDATE public.products SET stock = stock - v_qty WHERE id = v_product.id;
    END IF;

    IF v_price < 0 THEN RAISE EXCEPTION 'Prix négatif pour %', v_name; END IF;

    INSERT INTO public.order_items (order_id, product_id, variant_id, product_name, quantity, unit_price, total)
      VALUES (v_order_id, v_product.id, NULLIF(v_item->>'variant_id', '')::uuid, v_name, v_qty, v_price, v_price * v_qty);

    INSERT INTO public.stock_movements (store_id, product_id, variant_id, type, quantity, reason, created_by)
      VALUES (p_store_id, v_product.id, NULLIF(v_item->>'variant_id', '')::uuid, 'sale', -v_qty, v_order_number, p_created_by);

    v_subtotal := v_subtotal + (v_price * v_qty);
  END LOOP;

  v_total := v_subtotal + COALESCE(p_shipping, 0) - COALESCE(p_discount, 0);
  IF v_total < 0 THEN RAISE EXCEPTION 'Le total ne peut pas être négatif'; END IF;

  UPDATE public.orders SET subtotal = v_subtotal, total = v_total WHERE id = v_order_id;

  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers
      SET orders_count = orders_count + 1, total_spent = total_spent + v_total
      WHERE id = p_customer_id AND store_id = p_store_id;
  END IF;

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number,
    'total', v_total, 'public_token', v_token, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION private.create_order_core(uuid, uuid, jsonb, uuid, text, text, text, numeric, numeric, text, text, boolean, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- dashboard engine now delegates to the shared core
CREATE OR REPLACE FUNCTION public.create_order_transaction(
  p_store_id uuid,
  p_items jsonb,
  p_customer_id uuid DEFAULT NULL,
  p_channel text DEFAULT 'whatsapp',
  p_payment_status text DEFAULT 'unpaid',
  p_payment_method text DEFAULT NULL,
  p_shipping numeric DEFAULT 0,
  p_discount numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF NOT private.is_store_member(p_store_id, v_uid) THEN
    RAISE EXCEPTION 'Accès refusé à cette boutique';
  END IF;
  RETURN private.create_order_core(p_store_id, v_uid, p_items, p_customer_id, p_channel,
    p_payment_status, p_payment_method, p_shipping, p_discount, p_notes, p_idempotency_key, false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_transaction(uuid, jsonb, uuid, text, text, text, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_transaction(uuid, jsonb, uuid, text, text, text, numeric, numeric, text, text) TO authenticated, service_role;

-- ============ 7. Public checkout ============
CREATE OR REPLACE FUNCTION public.create_public_order(
  p_slug text,
  p_items jsonb,
  p_customer jsonb,
  p_shipping_option_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_store public.stores%ROWTYPE;
  v_customer_id uuid;
  v_phone text;
  v_name text;
  v_shipping numeric := 0;
  v_label text := NULL;
  v_opt public.shipping_options%ROWTYPE;
  v_address text;
BEGIN
  SELECT * INTO v_store FROM public.stores WHERE slug = p_slug AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Boutique introuvable'; END IF;

  v_name := btrim(COALESCE(p_customer->>'name', ''));
  v_phone := btrim(COALESCE(p_customer->>'phone', ''));
  IF length(v_name) < 2 OR length(v_name) > 120 THEN RAISE EXCEPTION 'Nom du client invalide'; END IF;
  IF length(v_phone) < 6 OR length(v_phone) > 30 THEN RAISE EXCEPTION 'Numéro de téléphone invalide'; END IF;

  IF p_shipping_option_id IS NOT NULL THEN
    SELECT * INTO v_opt FROM public.shipping_options
      WHERE id = p_shipping_option_id AND store_id = v_store.id AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Option de livraison indisponible'; END IF;
    v_shipping := v_opt.price;
    v_label := v_opt.name;
  ELSE
    v_label := 'Livraison à définir avec le vendeur';
  END IF;

  v_address := NULLIF(btrim(COALESCE(p_customer->>'address', '')), '');

  SELECT id INTO v_customer_id FROM public.customers
    WHERE store_id = v_store.id
      AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = regexp_replace(v_phone, '[^0-9]', '', 'g')
      AND regexp_replace(v_phone, '[^0-9]', '', 'g') <> ''
    ORDER BY created_at LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (store_id, name, phone, whatsapp, email, address, city, notes)
    VALUES (v_store.id, v_name, v_phone,
      NULLIF(btrim(COALESCE(p_customer->>'whatsapp', '')), ''),
      NULLIF(btrim(COALESCE(p_customer->>'email', '')), ''),
      v_address,
      NULLIF(btrim(COALESCE(p_customer->>'city', '')), ''),
      NULLIF(btrim(COALESCE(p_customer->>'district', '')), ''))
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers SET
      name = COALESCE(NULLIF(v_name, ''), name),
      whatsapp = COALESCE(NULLIF(btrim(COALESCE(p_customer->>'whatsapp', '')), ''), whatsapp),
      email = COALESCE(NULLIF(btrim(COALESCE(p_customer->>'email', '')), ''), email),
      address = COALESCE(v_address, address),
      city = COALESCE(NULLIF(btrim(COALESCE(p_customer->>'city', '')), ''), city)
    WHERE id = v_customer_id;
  END IF;

  RETURN private.create_order_core(
    v_store.id, NULL, p_items, v_customer_id, 'website', 'unpaid', NULL,
    v_shipping, 0, NULLIF(btrim(COALESCE(p_notes, '')), ''), p_idempotency_key, true,
    p_shipping_option_id, v_label, v_address,
    NULLIF(btrim(COALESCE(p_customer->>'city', '')), ''),
    NULLIF(btrim(COALESCE(p_customer->>'district', '')), '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order(text, jsonb, jsonb, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(text, jsonb, jsonb, uuid, text, text) TO anon, authenticated, service_role;

-- ============ 8. Public order lookup (number + private token) ============
CREATE OR REPLACE FUNCTION public.get_public_order(p_slug text, p_order_number text, p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_store public.stores%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_store FROM public.stores WHERE slug = p_slug AND is_active = true;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_order FROM public.orders
    WHERE store_id = v_store.id AND order_number = p_order_number AND public_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'order_number', v_order.order_number,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'subtotal', v_order.subtotal,
    'shipping', v_order.shipping,
    'discount', v_order.discount,
    'total', v_order.total,
    'currency', v_order.currency,
    'created_at', v_order.created_at,
    'shipping_label', v_order.shipping_label,
    'shipping_address', v_order.shipping_address,
    'shipping_city', v_order.shipping_city,
    'shipping_district', v_order.shipping_district,
    'store', jsonb_build_object('name', v_store.name, 'slug', v_store.slug,
      'phone', v_store.phone, 'whatsapp_number', v_store.whatsapp_number,
      'logo_url', v_store.logo_url),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('product_name', i.product_name, 'quantity', i.quantity,
        'unit_price', i.unit_price, 'total', i.total) ORDER BY i.created_at)
      FROM public.order_items i WHERE i.order_id = v_order.id), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_order(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order(text, text, uuid) TO anon, authenticated, service_role;

-- ============ 9. Helpful indexes ============
CREATE INDEX IF NOT EXISTS products_store_status_idx ON public.products (store_id, status) WHERE is_active;
CREATE INDEX IF NOT EXISTS shipping_options_store_idx ON public.shipping_options (store_id);
CREATE INDEX IF NOT EXISTS customers_store_phone_idx ON public.customers (store_id, phone);