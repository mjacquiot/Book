# Mission : Sécurisation de l'Onboarding et Correction de la Navigation

L'objectif est de s'assurer que l'utilisateur suit un parcours obligatoire d'initialisation (téléchargement du modèle IA et saisie du contexte personnel) avant d'accéder aux fonctionnalités de l'application, et de corriger les erreurs de navigation dans le bandeau supérieur.

## Analyse des Fichiers Impactés

- **[js/state.js](file:///c:/Users/Maxime/Outils_Elus/js/state.js)** :
    - Mise à jour de `syncFromSupabase` pour récupérer `personal_context` et `rag_whitelist` depuis le profil utilisateur.
    - Ajout d'une propriété `onboarding_required` ou logique similaire.
- **[js/views_app.js](file:///c:/Users/Maxime/Outils_Elus/js/views_app.js)** :
    - Modification de `render()` pour rediriger vers la vue `onboarding` si nécessaire.
    - Création de `renderOnboardingView()` pour forcer le téléchargement du modèle et la saisie du contexte.
    - Correction des appels `navigate` dans `renderAppLayout` (ex: changer `agenda` en `council`).
- **[js/init.js](file:///c:/Users/Maxime/Outils_Elus/js/init.js)** :
    - S'assurer que le worker IA communique bien l'état de chargement au state global.

## Modifications Techniques à Apporter

### 1. Synchronisation des Données d'Anonymisation
Dans `syncFromSupabase`, il faut charger `personal_context` et `rag_whitelist` dans le state pour pouvoir vérifier si l'utilisateur a rempli ses obligations.

### 2. Vue d'Onboarding Obligatoire
Créer une nouvelle vue `onboarding` qui :
- Affiche l'état du modèle Transformers.js (en attente/chargement/prêt).
- Propose un bouton pour forcer le chargement si besoin.
- Affiche des champs obligatoires pour le contexte personnel (`rag_pc`) et les entités à masquer (`rag_mc`).
- Empêche l'accès au reste de l'application tant que le modèle n'est pas `ready` et que `rag_pc` n'est pas rempli.

### 3. Correction de la Navigation
Certains boutons du `renderAppLayout` appellent des vues qui n'existent pas ou ont des noms différents dans `getContentForView` (ex: `navigate('agenda')` vs `case 'council'`). Harmoniser les noms.

### 4. Rappels et Sécurité
S'assurer que `navigate` ne permet pas de contourner l'onboarding.

## Validation Attendue
- À la connexion, si le contexte est vide ou le modèle non chargé, la page d'onboarding s'affiche.
- L'utilisateur ne peut pas en sortir sans avoir validé les étapes.
- Les onglets supérieurs (Scraper, RAG IA, Agenda) fonctionnent correctement.
