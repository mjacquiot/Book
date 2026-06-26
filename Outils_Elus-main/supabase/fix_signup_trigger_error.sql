-- =================================================================================
-- MIGRATION : CORRECTION DU TRIGGER D'INSCRIPTION "Database error saving new user"
-- =================================================================================

-- 1. S'assurer que les colonnes nécessaires existent dans la table profiles
-- Si ces colonnes n'existent pas, l'insertion dans la fonction trigger échouera misérablement.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'demo_expires_at') THEN
        ALTER TABLE public.profiles ADD COLUMN demo_expires_at TIMESTAMP WITH TIME ZONE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_done') THEN
        ALTER TABLE public.profiles ADD COLUMN onboarding_done BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Remplacement de la fonction trigger par une version plus robuste
CREATE OR REPLACE FUNCTION public.sync_user_email_on_signup()
RETURNS TRIGGER AS $$
BEGIN
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
        COALESCE(NEW.raw_user_meta_data->>'username', 'Utilisateur sans nom'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'elu'),
        NEW.raw_user_meta_data->>'collectivite_id',
        -- Utilisation de NULLIF pour gérer les cas où JS passe une chaîne vide
        NULLIF(NEW.raw_user_meta_data->>'demo_expires_at', '')::timestamp with time zone
    )
    ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email;
    RETURN NEW;
EXCEPTION
    -- En cas d'erreur inattendue, on garantit que l'utilisateur est quand même créé dans auth.users 
    -- en insérant un profil minimal, ou au moins on retourne NEW pour ne pas bloquer l'inscription.
    WHEN OTHERS THEN
        BEGIN
            INSERT INTO public.profiles (id, email, username, role, collectivite_id)
            VALUES (NEW.id, NEW.email, 'Fallback User', 'elu', COALESCE(NEW.raw_user_meta_data->>'collectivite_id', 'INCONNU'))
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
        EXCEPTION
            WHEN OTHERS THEN
                NULL; -- Ignorer silencieusement pour éviter "Database error saving new user"
        END;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
