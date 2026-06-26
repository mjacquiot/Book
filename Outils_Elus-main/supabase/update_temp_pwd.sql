-- Script SQL : Ajout des mots de passe temporaires
-- A exécuter dans le SQL Editor de Supabase pour permettre la pré-autorisation sécurisée.

ALTER TABLE public.allowed_registrations
ADD COLUMN IF NOT EXISTS temp_pwd TEXT;
