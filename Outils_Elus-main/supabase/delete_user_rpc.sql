-- =================================================================================
-- SCRIPT: SUPPRESSION D'UN UTILISATEUR ET DE SES ACCÈS (CASCADE)
-- Pour garantir la suppression des traces et permettre une réinscription.
-- =================================================================================

-- Cette fonction permet de supprimer physiquement un compte "auth.users" 
-- en tant que SuperAdmin (bypass RLS grâce au SECURITY DEFINER).
--
-- Étapes:
-- 1. Récupère l'email de l'utilisateur pour nettoyer "allowed_registrations"
-- 2. Supprime l'utilisateur de `auth.users`, ce qui, via vos contraintes 
--    ON DELETE CASCADE existantes, supprimera automatiquement ses lignes dans 
--    les tables `profiles`, `user_crypto_keys`, et `collectivity_shared_keys`.
-- 3. Nettoie la table de pré-autorisation.

CREATE OR REPLACE FUNCTION public.delete_user_cascade(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_email text;
BEGIN
    -- 1. Récupérer l'email avant que l'utilisateur soit supprimé
    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;

    IF target_email IS NOT NULL THEN
        -- 2. Supprimer la pré-autorisation liée à cet email
        -- Cela 'libère' l'email pour de futures invitations
        DELETE FROM public.allowed_registrations WHERE email = target_email;
    END IF;

    -- 3. Supprimer l'utilisateur de la table interne auth.users
    -- Cela va déclencher le ON DELETE CASCADE sur:
    --   - public.profiles
    --   - public.user_crypto_keys
    --   - public.collectivity_shared_keys
    -- permettant la destruction intégrale des traces de l'utilisateur.
    DELETE FROM auth.users WHERE id = target_user_id;

END;
$$;

-- IMPORTANT: Toujours s'assurer que seuls les comptes de service
-- ou authentifiés de cette fonction ne peuvent l'appeler.
-- La RLS est court-circuitée par 'SECURITY DEFINER', donc 
-- nous révoquons l'accès public et l'autorisons explicitement 
-- aux utilisateurs connectés.
REVOKE ALL ON FUNCTION public.delete_user_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid) TO service_role;
