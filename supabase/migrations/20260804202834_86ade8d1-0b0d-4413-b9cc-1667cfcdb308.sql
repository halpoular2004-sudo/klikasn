CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_store_member(_store_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = _user_id
    UNION
    SELECT 1 FROM public.store_members m WHERE m.store_id = _store_id AND m.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_store_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_store_member(uuid, uuid) TO authenticated, service_role;

-- activity_logs
DROP POLICY IF EXISTS activity_logs_insert_members ON public.activity_logs;
CREATE POLICY activity_logs_insert_members ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (private.is_store_member(store_id, auth.uid()) AND ((user_id = auth.uid()) OR (user_id IS NULL)));
DROP POLICY IF EXISTS activity_logs_select_members ON public.activity_logs;
CREATE POLICY activity_logs_select_members ON public.activity_logs FOR SELECT TO authenticated
  USING (private.is_store_member(store_id, auth.uid()));

-- categories
DROP POLICY IF EXISTS categories_members_all ON public.categories;
CREATE POLICY categories_members_all ON public.categories FOR ALL TO authenticated
  USING (private.is_store_member(store_id, auth.uid())) WITH CHECK (private.is_store_member(store_id, auth.uid()));

-- customers
DROP POLICY IF EXISTS customers_members_all ON public.customers;
CREATE POLICY customers_members_all ON public.customers FOR ALL TO authenticated
  USING (private.is_store_member(store_id, auth.uid())) WITH CHECK (private.is_store_member(store_id, auth.uid()));

-- order_items
DROP POLICY IF EXISTS order_items_members_all ON public.order_items;
CREATE POLICY order_items_members_all ON public.order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND private.is_store_member(o.store_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND private.is_store_member(o.store_id, auth.uid())));

-- orders
DROP POLICY IF EXISTS orders_members_all ON public.orders;
CREATE POLICY orders_members_all ON public.orders FOR ALL TO authenticated
  USING (private.is_store_member(store_id, auth.uid())) WITH CHECK (private.is_store_member(store_id, auth.uid()));

-- product_variants
DROP POLICY IF EXISTS product_variants_members_all ON public.product_variants;
CREATE POLICY product_variants_members_all ON public.product_variants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND private.is_store_member(p.store_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND private.is_store_member(p.store_id, auth.uid())));

-- products
DROP POLICY IF EXISTS products_members_all ON public.products;
CREATE POLICY products_members_all ON public.products FOR ALL TO authenticated
  USING (private.is_store_member(store_id, auth.uid())) WITH CHECK (private.is_store_member(store_id, auth.uid()));

-- stock_movements
DROP POLICY IF EXISTS stock_movements_members_all ON public.stock_movements;
CREATE POLICY stock_movements_members_all ON public.stock_movements FOR ALL TO authenticated
  USING (private.is_store_member(store_id, auth.uid())) WITH CHECK (private.is_store_member(store_id, auth.uid()));

-- store_members
DROP POLICY IF EXISTS store_members_select ON public.store_members;
CREATE POLICY store_members_select ON public.store_members FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.is_store_member(store_id, auth.uid()));

-- stores
DROP POLICY IF EXISTS stores_select_members ON public.stores;
CREATE POLICY stores_select_members ON public.stores FOR SELECT TO authenticated
  USING ((owner_id = auth.uid()) OR private.is_store_member(id, auth.uid()));

-- user_roles
DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;
CREATE POLICY user_roles_admin_manage ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_store_member(uuid, uuid);