
-- Admin invitations table
CREATE TABLE public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'admin',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invitations TO authenticated;
GRANT ALL ON public.admin_invitations TO service_role;

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can manage all invitations
CREATE POLICY "Admins manage invitations"
ON public.admin_invitations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anyone authenticated can read their own invitation by token (handled via RPC instead for safety)

CREATE TRIGGER update_admin_invitations_updated_at
BEFORE UPDATE ON public.admin_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to accept an invitation by token (caller must be authenticated)
CREATE OR REPLACE FUNCTION public.accept_admin_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.admin_invitations%ROWTYPE;
  _user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO _inv FROM public.admin_invitations WHERE token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF _inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_accepted');
  END IF;

  IF _inv.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  IF lower(_inv.email) <> lower(_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.admin_invitations
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = _inv.id;

  RETURN jsonb_build_object('success', true, 'role', _inv.role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_admin_invitation(text) TO authenticated;

-- Lookup function so an invitee can preview an invitation before signing in
CREATE OR REPLACE FUNCTION public.get_invitation_info(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.admin_invitations%ROWTYPE;
BEGIN
  SELECT * INTO _inv FROM public.admin_invitations WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;
  IF _inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'already_accepted');
  END IF;
  IF _inv.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired');
  END IF;
  RETURN jsonb_build_object('valid', true, 'email', _inv.email, 'role', _inv.role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_info(text) TO anon, authenticated;
