-- =================================================================================
-- MIGRATION : CORRECTION DES FOREIGN KEYS ET SYNCHRONISATION DE L'EMAIL (PROFILES)
-- =================================================================================

-- 1. Réparation des contraintes de clés étrangères (On Delete Cascade)
-- Pour éviter l'erreur : violates foreign key constraint "user_crypto_keys_user_id_fkey"
ALTER TABLE public.user_crypto_keys
    DROP CONSTRAINT IF EXISTS user_crypto_keys_user_id_fkey;

ALTER TABLE public.user_crypto_keys
    ADD CONSTRAINT user_crypto_keys_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

ALTER TABLE public.collectivity_shared_keys
    DROP CONSTRAINT IF EXISTS collectivity_shared_keys_user_id_fkey;

ALTER TABLE public.collectivity_shared_keys
    ADD CONSTRAINT collectivity_shared_keys_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- 2. Ajout de la colonne email à profiles si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- 3. Mise à jour de tous les profils existants pour récupérer l'email depuis auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 4. Création d'un Trigger pour synchroniser l'email lors d'une nouvelle inscription 
-- (Si jamais l'application Frontend n'insère pas l'email manuellement)
CREATE OR REPLACE FUNCTION public.sync_user_email_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    -- On insère le profil uniquement si ce n'est pas déjà géré par l'application explicitement
    -- L'application EluConnect fera un upsert si besoin, mais voici la garantie "base de données"
    INSERT INTO public.profiles (
        id, 
        email,
        username,
        role,
        collectivite_id,
        demo_expires_at
    )
    VALUES (
        NEW.id, 
        NEW.email,
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'role',
        NEW.raw_user_meta_data->>'collectivite_id',
        (NEW.raw_user_meta_data->>'demo_expires_at')::timestamp with time zone
    )
    ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Suppression du trigger s'il existait déjà pour le recréer proprement
DROP TRIGGER IF EXISTS on_auth_user_created_sync_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_sync_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_email_on_signup();
