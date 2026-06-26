-- Appliquer les modifications au schéma pour supporter le système Zero-Knowledge et le rôle Démo

-- 1. Ajout des colonnes d'IV d'initialisation pour le chiffrement Zero-Knowledge
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS iv TEXT;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS iv TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS iv TEXT;

-- 2. Ajout de la date d'expiration optionnelle pour le rôle "Démo"
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMP WITH TIME ZONE NULL;

-- 3. Ajout de l'expiration pour l'héritage d'invitation (les comptes créés par un compte DEMO héritent de l'expiration)
ALTER TABLE public.allowed_registrations ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMP WITH TIME ZONE NULL;

-- 4. Ajout du flag onboarding_done pour le parcours de première connexion obligatoire
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE;
