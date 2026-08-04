-- 1. Schema additions ------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS orders_store_idempotency_key_uidx
  ON public.orders (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_store_order_number_uidx
  ON public.orders (store_id, order_number);

CREATE TABLE IF NOT EXISTS public.order_counters (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, year)
);
GRANT SELECT ON public.order_counters TO authenticated;
GRANT ALL ON public.order_counters TO service_role;
ALTER TABLE public.order_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_counters_select_members ON public.order_counters;
CREATE POLICY order_counters_select_members ON public.order_counters FOR SELECT TO authenticated
  USING (private.is_store_member(store_id, auth.uid()));

-- 2. Order creation ---------------------------------------------------------
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
  v_year integer := EXTRACT(YEAR FROM now())::int;
  v_seq integer;
  v_existing public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF NOT private.is_store_member(p_store_id, v_uid) THEN
    RAISE EXCEPTION 'Accès refusé à cette boutique';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.orders
      WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number,
        'total', v_existing.total, 'duplicate', true);
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La commande doit contenir au moins un article';
  END IF;
  IF COALESCE(p_shipping, 0) < 0 THEN RAISE EXCEPTION 'Frais de livraison négatifs'; END IF;
  IF COALESCE(p_discount, 0) < 0 THEN RAISE EXCEPTION 'Remise négative'; END IF;

  -- counter (per store/year), locks the counter row
  INSERT INTO public.order_counters (store_id, year, last_number)
    VALUES (p_store_id, v_year, 1)
  ON CONFLICT (store_id, year) DO UPDATE SET last_number = public.order_counters.last_number + 1
  RETURNING last_number INTO v_seq;

  v_order_number := 'KS-' || v_year || '-' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.orders (store_id, customer_id, order_number, status, payment_status,
      payment_method, channel, subtotal, shipping, discount, total, notes, created_by,
      idempotency_key, stock_deducted)
  VALUES (p_store_id, p_customer_id, v_order_number, 'pending',
      COALESCE(p_payment_status, 'unpaid')::public.payment_status,
      NULLIF(p_payment_method, '')::public.payment_method,
      COALESCE(p_channel, 'whatsapp')::public.order_channel,
      0, COALESCE(p_shipping, 0), COALESCE(p_discount, 0), 0, NULLIF(p_notes, ''), v_uid,
      p_idempotency_key, true)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantité invalide'; END IF;

    SELECT * INTO v_product FROM public.products
      WHERE id = (v_item->>'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
    IF v_product.store_id <> p_store_id THEN
      RAISE EXCEPTION 'Le produit % n''appartient pas à cette boutique', v_product.name;
    END IF;

    IF COALESCE(v_item->>'variant_id', '') <> '' THEN
      SELECT * INTO v_variant FROM public.product_variants
        WHERE id = (v_item->>'variant_id')::uuid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variante introuvable'; END IF;
      IF v_variant.product_id <> v_product.id THEN
        RAISE EXCEPTION 'La variante ne correspond pas au produit %', v_product.name;
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
      VALUES (p_store_id, v_product.id, NULLIF(v_item->>'variant_id', '')::uuid, 'sale', -v_qty, v_order_number, v_uid);

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
    'total', v_total, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_transaction(uuid, jsonb, uuid, text, text, text, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_transaction(uuid, jsonb, uuid, text, text, text, numeric, numeric, text, text) TO authenticated, service_role;

-- 3. Status transitions -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_new public.order_status := p_status::public.order_status;
  v_item public.order_items%ROWTYPE;
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF NOT private.is_store_member(v_order.store_id, v_uid) THEN
    RAISE EXCEPTION 'Accès refusé à cette boutique';
  END IF;

  IF v_order.status = v_new THEN
    RETURN jsonb_build_object('order_id', v_order.id, 'status', v_new);
  END IF;

  v_allowed := (v_order.status, v_new) IN (
    ('pending','confirmed'), ('confirmed','processing'), ('processing','shipped'),
    ('shipped','delivered'), ('pending','cancelled'), ('confirmed','cancelled'),
    ('processing','cancelled'), ('delivered','refunded')
  );
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition non autorisée : % → %', v_order.status, v_new;
  END IF;

  -- restock on cancellation / refund, only if stock was deducted
  IF v_new IN ('cancelled', 'refunded') AND v_order.stock_deducted THEN
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = v_order.id LOOP
      IF v_item.variant_id IS NOT NULL THEN
        UPDATE public.product_variants SET stock = stock + v_item.quantity WHERE id = v_item.variant_id;
      ELSIF v_item.product_id IS NOT NULL THEN
        UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
      END IF;
      IF v_item.product_id IS NOT NULL THEN
        INSERT INTO public.stock_movements (store_id, product_id, variant_id, type, quantity, reason, created_by)
          VALUES (v_order.store_id, v_item.product_id, v_item.variant_id, 'return', v_item.quantity,
                  v_order.order_number || ' (' || v_new || ')', v_uid);
      END IF;
    END LOOP;

    IF v_order.customer_id IS NOT NULL THEN
      UPDATE public.customers
        SET orders_count = GREATEST(orders_count - 1, 0),
            total_spent = GREATEST(total_spent - v_order.total, 0)
        WHERE id = v_order.customer_id;
    END IF;
  END IF;

  UPDATE public.orders SET
    status = v_new,
    stock_deducted = CASE WHEN v_new IN ('cancelled','refunded') THEN false ELSE stock_deducted END,
    confirmed_at = CASE WHEN v_new = 'confirmed' THEN now() ELSE confirmed_at END,
    cancelled_at = CASE WHEN v_new = 'cancelled' THEN now() ELSE cancelled_at END,
    delivered_at = CASE WHEN v_new = 'delivered' THEN now() ELSE delivered_at END
  WHERE id = v_order.id;

  RETURN jsonb_build_object('order_id', v_order.id, 'status', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text) TO authenticated, service_role;

-- 4. Stock adjustment -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_store_id uuid,
  p_product_id uuid,
  p_type text,
  p_quantity integer,
  p_variant_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current integer;
  v_delta integer;
  v_new integer;
  v_product public.products%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF NOT private.is_store_member(p_store_id, v_uid) THEN
    RAISE EXCEPTION 'Accès refusé à cette boutique';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 0 THEN RAISE EXCEPTION 'Quantité invalide'; END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
  IF v_product.store_id <> p_store_id THEN RAISE EXCEPTION 'Produit hors boutique'; END IF;

  IF p_variant_id IS NOT NULL THEN
    SELECT stock INTO v_current FROM public.product_variants
      WHERE id = p_variant_id AND product_id = p_product_id FOR UPDATE;
    IF v_current IS NULL THEN RAISE EXCEPTION 'Variante introuvable'; END IF;
  ELSE
    v_current := v_product.stock;
  END IF;

  v_delta := CASE
    WHEN p_type = 'adjustment' THEN p_quantity - v_current
    WHEN p_type IN ('in', 'return') THEN p_quantity
    ELSE -p_quantity
  END;
  v_new := v_current + v_delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'Stock insuffisant. Disponible : %', v_current;
  END IF;

  IF p_variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock = v_new WHERE id = p_variant_id;
  ELSE
    UPDATE public.products SET stock = v_new WHERE id = p_product_id;
  END IF;

  INSERT INTO public.stock_movements (store_id, product_id, variant_id, type, quantity, reason, created_by)
    VALUES (p_store_id, p_product_id, p_variant_id, p_type::public.stock_movement_type, v_delta,
            NULLIF(p_reason, ''), v_uid);

  RETURN jsonb_build_object('stock', v_new, 'delta', v_delta);
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_stock(uuid, uuid, text, integer, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, uuid, text, integer, uuid, text) TO authenticated, service_role;