# DiaExpress — Cartographie des cas d’usage réels (état du code)

## 0) Périmètre réellement analysé

Ce document est basé uniquement sur le code présent dans ce dépôt.

### 0.1 Artefacts trouvés et analysés
- **Application Next.js principale** (routes `pages/*`).
- **Package fonctionnel partagé** `packages/diaexpress-shared` (pages, composants, auth, API client).
- **README** et notes de structure.

### 0.2 Limites constatées
- Le **backend principal (Express/Nest, controllers/services/models/middleware)** n’est **pas présent** dans ce dépôt.
- Les apps mentionnées `apps/diaexpress-adminv2` et `apps/diaexpress-client` ne sont pas présentes sous cette arborescence ; le dépôt contient une app client Next à la racine + un package partagé.

Conséquence : les use cases backend sont documentés via les **contrats d’API consommés par le frontend** (source de vérité disponible ici), pas via des controllers/models backend inexistants dans le repo analysé.

---

## A. Vue d’ensemble produit

## A.1 Vision produit observée
La plateforme implémente un portail logistique orienté :
- **demande de devis** multi-étapes,
- **estimation tarifaire**,
- **création d’expédition**,
- **suivi d’expédition (tracking)**,
- **paiement associé aux devis**,
- **gestion d’adresses client**,
- **réservation sur planning public**,
- et des **écrans d’administration** (devis, pricing, expéditions, schedules, external pricing, users) disponibles dans le package partagé.

## A.2 Typologie d’utilisateurs (déduite du code)
- **Client** : demande de devis, suivi de ses devis/envois, paiements, adresses.
- **Admin** : dashboards et modules de pilotage (quotes, shipments, pricing, package types, schedules, users, external pricing).
- **Delivery** : rôle prévu via route protégée `/delivery`.
- **Public / non authentifié** : landing, tracking public, réservation publique (soumise avec token si disponible).
- **Support / finance / opérateur logistique** : pas de rôle explicite séparé trouvé ; leurs actions semblent absorbées par le rôle `admin`.

---

## B. Cartographie des modules

## B.1 Authentification / autorisation

| Élément | Réalité implémentée |
|---|---|
| Provider d’identité | Clerk (avec fallback dev token) |
| Garde d’accès | `ProtectedRoute` + `RoleProtected` + `useAdminAuthGuard` |
| Source du rôle | Metadata Clerk + user DB synchronisé `/api/users/me` |
| RBAC fin | Basique côté UI (contrôle de rendu), pas de politique fine visible côté backend (non présent) |

Endpoints consommés :
- `GET /api/users/me`
- `GET /api/admin/users/me` (fallback)

## B.2 Quotes / devis

| Aspect | Réalité |
|---|---|
| Création devis | Wizard client (`QuoteWizard`) |
| Estimation | `POST /api/quotes/estimateQuote` |
| Persistance devis | `POST /api/quotes` |
| Liste client | `GET /api/quotes/me` |
| Liste admin | fallback `/api/admin/quotes`, `/api/quotes`, `/api/quotes/all` |
| Update statut | `PATCH /api/quotes/:id/status` |
| Paiement d’un devis | `POST /api/quotes/:id/pay` |
| Actions legacy supplémentaires | confirm/reject/dispatch/tracking dans `api/quotes.js` (non utilisées par l’UI principale actuelle) |

## B.3 Shipments / expéditions

| Aspect | Réalité |
|---|---|
| Création depuis devis | `POST /api/shipments/create-from-quote` (automatique après création devis dans le wizard) |
| Liste client | `GET /api/shipments/me` |
| Liste admin | `/api/admin/shipments` avec fallback `/api/shipments` |
| Détail expédition | `GET /api/shipments/:id` |
| Mise à jour statut | `PATCH /api/admin/shipments/:id/status` fallback `/api/shipments/:id/status` |
| Suppression | `DELETE /api/admin/shipments/:id` fallback `/api/shipments/:id` |
| Tracking public | `GET /api/tracking/:code` |

## B.4 Pricing / tarification

| Aspect | Réalité |
|---|---|
| CRUD pricing admin | list/create/update/delete via `/api/admin/pricing` avec fallback `/api/pricing` |
| Routes publiques pour réservation | `GET /api/pricing/routes` |
| Source package types | `GET /api/package-types` |
| Données adresse utilisées dans pricing | `GET /api/addresses` |

## B.5 External pricing (CMA CGM)

| Aspect | Réalité |
|---|---|
| Consultation tarifs externes | `GET /api/external-pricing` |
| Sync externe | `GET /api/external-pricing/sync` |
| Credentials meta | `GET /api/external-pricing/credentials` |
| Mise à jour credentials | `POST /api/external-pricing/credentials` |

## B.6 Réservations / schedules

| Aspect | Réalité |
|---|---|
| Consultation schedules publics | `GET /api/schedules/public` |
| Création réservation | `POST /api/reservations` |
| Consultation réservations client | `GET /api/reservations/me` |
| Module admin schedules | UI présente (`AdminSchedules`) avec appels `/api/schedules` (liste/create/delete) |

## B.7 Paiement (diaPay côté UX)

| Aspect | Réalité |
|---|---|
| Initialisation paiement | `POST /api/payments/create` (dialog) |
| Historique paiements client | `GET /api/payments/mine` |
| Validation devis payé | `POST /api/quotes/:id/pay` |
| Intégration PSP réelle (redirect/webhook) | Non visible dans ce repo (backend absent) |

## B.8 Adresses / points de collecte

| Aspect | Réalité |
|---|---|
| CRUD adresses utilisateur | `GET/POST/PUT/DELETE /api/addresses(:id)` |
| Données avancées | support `gpsLocation` (lat/lng/accuracy/provider/capturedAt) |
| Réutilisation | Wizard devis + page profile + admin pricing |

## B.9 Notifications

| Aspect | Réalité |
|---|---|
| Récupération | `GET /api/notifications/me` |
| Marquage lu | `POST /api/notifications/:id/read` |
| Exposition UI | pas d’écran dédié trouvé dans les routes Next actives |

---

## C. Use cases détaillés (source: code actuel)

Légende :
- ✅ complet (dans le périmètre frontend observé)
- ⚠️ partiel
- ❌ manquant côté UI
- ❌ manquant côté backend (non visible dans ce repo)

## C.1 Demander une estimation de devis
- **Acteur** : client/public
- **Déclencheur** : wizard `/quote-request`
- **Étapes** : saisie itinéraire + cargo → calcul estimation
- **Endpoints** : `POST /api/quotes/estimateQuote`, `GET /api/quotes/meta`
- **Modèles impliqués** (inférés côté API) : Quote, Pricing, PackageType
- **Résultat** : liste d’offres (provider/prix) triées
- **Statut** : ✅

## C.2 Créer un devis
- **Acteur** : client (connecté)
- **Déclencheur** : soumission étape finale wizard
- **Étapes** : validation schémas, enrichissement payload, création quote
- **Endpoints** : `POST /api/quotes`
- **Résultat** : quote persisté avec `_id`
- **Statut** : ✅

## C.3 Convertir un devis en shipment
- **Acteur** : client (wizard) / client (UserQuotes) / admin (indirect)
- **Déclencheur** : post-création quote ou action dédiée
- **Étapes** : appel conversion puis redirection confirmation
- **Endpoints** : `POST /api/shipments/create-from-quote`
- **Résultat** : shipment créé + tracking code attendu
- **Statut** : ✅

## C.4 Consulter ses devis
- **Acteur** : client
- **Endpoints** : `GET /api/quotes/me`
- **Résultat** : listing + statut + actions paiement
- **Statut** : ✅

## C.5 Valider / rejeter / dispatcher un devis (admin)
- **Acteur** : admin
- **UI actuelle** : `AdminQuotes` met à jour via `PATCH /api/quotes/:id/status`
- **Endpoints alternatifs présents** : `/confirm`, `/reject`, `/dispatch` (fichier API legacy)
- **Résultat** : changement de statut
- **Statut** : ⚠️ partiel (plusieurs conventions d’API coexistantes)

## C.6 Modifier le prix d’un devis
- **Acteur** : admin
- **Constat** : pas d’écran explicite d’édition de prix quote dans pages Next actives ; update générique quote existe dans API legacy (`PATCH /api/quotes/:id`).
- **Statut** : ❌ manquant côté UI (dans routes actives)

## C.7 Payer un devis
- **Acteur** : client
- **Étapes** : `PaymentDialog` → `POST /api/payments/create` → confirmation quote via `POST /api/quotes/:id/pay`
- **Résultat** : reçu/confirmation affichés
- **Statut** : ✅ (UX interne) / ⚠️ (pas de flux PSP redirect visible)

## C.8 Suivre un colis
- **Acteur** : public/client
- **Endpoints** : `GET /api/tracking/:code`
- **Résultat** : timeline statuts + métadonnées expédition
- **Statut** : ✅

## C.9 Gérer ses adresses
- **Acteur** : client
- **Endpoints** : `GET/POST/PUT/DELETE /api/addresses`
- **Résultat** : carnet d’adresses réutilisé dans devis
- **Statut** : ✅

## C.10 Gérer les tarifs (admin)
- **Acteur** : admin
- **Endpoints** : `/api/admin/pricing` (fallback `/api/pricing`), `/api/package-types`
- **Résultat** : CRUD grilles multi-transport + sous-structures (ranges/packagePricing/containerPricing)
- **Statut** : ✅

## C.11 Gérer les types de colis (admin)
- **Acteur** : admin
- **Endpoints** : `GET/POST/PUT/DELETE /api/package-types`
- **Statut** : ✅

## C.12 Gérer les expéditions (admin)
- **Acteur** : admin/opérations
- **Endpoints** : list/update status/delete sur shipments
- **Statut** : ✅

## C.13 Réserver un départ (publique)
- **Acteur** : public/client connecté
- **Endpoints** : `GET /api/pricing/routes`, `GET /api/schedules/public`, `POST /api/reservations`
- **Statut** : ✅

## C.14 Gérer schedules (admin)
- **Acteur** : admin
- **Endpoints** : `GET/POST/DELETE /api/schedules`
- **Statut** : ⚠️ partiel (UI présente dans package partagé, mais pas de route Next active visible pour l’exposer)

## C.15 Gérer external pricing + credentials CMA CGM
- **Acteur** : admin
- **Endpoints** : `/api/external-pricing*`
- **Statut** : ⚠️ partiel (UI présente dans package partagé, pas de route Next active dédiée dans `pages/`)

## C.16 Notifications
- **Acteur** : client/admin
- **Endpoints** : `/api/notifications/me`, `/api/notifications/:id/read`
- **Statut** : ❌ manquant côté UI actif

## C.17 Embarkments / market points / countries dédiés
- **Constat** : pas de module dédié explicitement nommé “embarkments/market points/countries” trouvé ; la logique est portée surtout par pricing routes + schedules.
- **Statut** : ❌ non identifié dans le code présent

---

## D. Flux métier transverses

## D.1 Flux principal quote → shipment
1. Saisie devis (`/quote-request`) 
2. Estimation (`/api/quotes/estimateQuote`) 
3. Création devis (`/api/quotes`) 
4. Conversion immédiate en shipment (`/api/shipments/create-from-quote`) 
5. Confirmation shipment (`/shipment/:id/confirm`) 
6. Suivi via code (`/track-shipment`) 

**État** : ✅ flux implémenté de bout en bout côté frontend.

## D.2 Flux quote admin → statut → paiement
1. Admin consulte devis (`AdminQuotes`) 
2. Change statut (`PATCH /api/quotes/:id/status`) 
3. Client paie (`POST /api/payments/create`) 
4. Confirmation paiement devis (`POST /api/quotes/:id/pay`) 

**État** : ⚠️ conventions API multiples sur les statuts (endpoints alternatifs legacy).

## D.3 Flux pricing → estimation
1. Admin maintient grilles (`AdminPricing`) 
2. Client demande estimation 
3. API retourne 1..n offres (provider/interne/externe)

**État** : ✅ côté UI/front.

## D.4 Flux réservation
1. Public choisit route + schedule 
2. Soumission réservation (`POST /api/reservations`) 
3. Client consulte ses réservations (`/api/reservations/me`)

**État** : ✅ sur le périmètre visible.

---

## E. État réel de l’implémentation

## E.1 Fonctionnalités opérationnelles (dans routes Next actives)
- Landing + dashboard public.
- Demande de devis wizard avec estimation.
- Création quote + auto-conversion shipment.
- Tracking public.
- Liste devis client + paiement.
- Liste envois client.
- Gestion adresses client.
- Réservation publique + consultation client réservations.

## E.2 Fonctionnalités partiellement branchées
- Admin complet (quotes/shipments/pricing/users/schedules/external pricing) : composants/pages présents dans `@diaexpress/shared`, mais **routes Next admin non déclarées** dans `pages/` racine actuelle.
- Paiement : UX de paiement présente, mais orchestration PSP/webhooks non vérifiable sans backend.
- Multiples conventions endpoint (fallbacks et fichiers API legacy) : risque d’incohérence runtime.

## E.3 Backend présent sans UI (dans ce repo)
- Non applicable : backend absent de ce dépôt.

## E.4 UI présente sans backend vérifiable ici
- Tous les modules API consommés ; comportement final dépend d’un backend externe configuré par env.

---

## F. Dépendances et points d’attention

## F.1 Dépendances inter-modules
- **QuoteWizard** dépend de : quote meta + estimation + package types + adresses + auth token.
- **Shipments** dépend de création quote et conversion quote→shipment.
- **Tracking** dépend de la qualité de `statusHistory` backend.
- **Reservations** dépend de pricing routes + schedules.
- **RBAC** dépend du rôle retourné par `/api/users/me` et/ou metadata Clerk.

## F.2 Endpoints sensibles
- `POST /api/payments/create`
- `POST /api/quotes/:id/pay`
- `PATCH /api/quotes/:id/status`
- `PATCH /api/shipments/:id/status`
- `POST /api/external-pricing/credentials`

## F.3 Auth / RBAC
- Protection côté UI présente mais non suffisante seule.
- Nécessité absolue d’un contrôle serveur (non auditable ici).
- Mode dev admin peut bypasser Clerk (`useDevAdminSession`) : utile localement, à encadrer en production.

## F.4 Points bloquants
- Backend manquant dans repo ⇒ impossibilité de certifier modèles DB, middleware sécurité, webhooks, transactions.
- Incohérence potentielle de contrats API (fallbacks multiples).
- Admin UI non exposée dans routes Next actuelles.

## F.5 Legacy / historique
- Duplications `src/pages`, `src/views`, `src/api` à la racine semblent historiques/miroirs d’anciens écrans ; la version active côté Next root route surtout vers `@diaexpress/shared`.
- Fichier `api/quotes.js` contient des endpoints alternatifs non exploités par les pages principales modernes (potentiel héritage).

---

## G. Recommandations d’itérations (priorisées)

## Itération 1 — Stabiliser contrats API + auth critique
- **Objectif** : supprimer ambiguïtés endpoint/fallback et sécuriser auth serveur.
- **Modules** : auth, quotes, shipments, payments.
- **Valeur** : réduction incidents prod + sécurité accrue.
- **Dépendances** : accès backend principal.

## Itération 2 — Exposer explicitement le cockpit admin v2
- **Objectif** : déclarer routes Next admin actives (`/admin/*`) vers pages déjà prêtes.
- **Modules** : AdminPage, AdminQuotes, AdminShipments, AdminPricing, AdminUsers.
- **Valeur** : opérationnel complet pour équipes internes.
- **Dépendances** : RBAC serveur robuste.

## Itération 3 — Solidifier flux Quote → Paiement → Shipment
- **Objectif** : unifier parcours et statuts (pending/confirmed/dispatched/paid) avec règles métier explicites.
- **Modules** : quote wizard, quotes client/admin, payments.
- **Valeur** : conversion commerciale + traçabilité finance.
- **Dépendances** : normalisation modèle quote côté backend.

## Itération 4 — Industrialiser planning/réservations
- **Objectif** : relier réservations à shipments et visibilité admin/planning.
- **Modules** : public reservation, client reservations, admin schedules.
- **Valeur** : meilleure planification capacitaire.
- **Dépendances** : modèle planning/réservation unifié backend.

## Itération 5 — Observabilité tracking & notifications
- **Objectif** : activer notifications UI et monitoring de progression livraison.
- **Modules** : tracking, notifications, admin shipments.
- **Valeur** : expérience client + réduction tickets support.
- **Dépendances** : events backend/webhooks.

