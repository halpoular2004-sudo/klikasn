DROP VIEW IF EXISTS public.shop_variants;
DROP VIEW IF EXISTS public.shop_products;
DROP VIEW IF EXISTS public.shop_categories;
DROP VIEW IF EXISTS public.shop_shipping_options;
DROP VIEW IF EXISTS public.shop_stores;

CREATE OR REPLACE FUNCTION public.get_public_shop(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_store public.stores%ROWTYPE;
BEGIN
  SELECT * INTO v_store FROM public.stores WHERE slug = p_slug AND is_active = true;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'store', jsonb_build_object(
      'id', v_store.id, 'name', v_store.name, 'slug', v_store.slug,
      'description', v_store.description, 'logo_url', v_store.logo_url,
      'currency', v_store.currency, 'country', v_store.country,
      'phone', v_store.phone, 'whatsapp_number', v_store.whatsapp_number,
      'address', v_store.address, 'show_stock', v_store.show_stock,
      'shipping_note', v_store.shipping_note
    ),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'description', c.description)
        ORDER BY c.name)
      FROM public.categories c WHERE c.store_id = v_store.id), '[]'::jsonb),
    'shipping_options', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price', o.price)
        ORDER BY o.sort_order, o.name)
      FROM public.shipping_options o
      WHERE o.store_id = v_store.id AND o.is_active = true), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'category_id', p.category_id, 'name', p.name,
        'description', p.description, 'price', p.price,
        'compare_at_price', p.compare_at_price, 'image_url', p.image_url,
        'unit', p.unit,
        'in_stock', (p.stock > 0),
        'available_stock', CASE WHEN v_store.show_stock THEN p.stock ELSE NULL END,
        'variants', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', v.id, 'name', v.name, 'value', v.value,
            'price', COALESCE(v.price, p.price),
            'in_stock', (v.stock > 0),
            'available_stock', CASE WHEN v_store.show_stock THEN v.stock ELSE NULL END)
            ORDER BY v.name, v.value)
          FROM public.product_variants v
          WHERE v.product_id = p.id AND v.is_active = true), '[]'::jsonb)
      ) ORDER BY p.name)
      FROM public.products p
      WHERE p.store_id = v_store.id AND p.is_active = true AND p.status = 'published'), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_shop(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_shop(text) TO anon, authenticated, service_role;