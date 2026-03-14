# DiaExpress — Synthèse 1 page des cas d’usage

## Ce que fait l’application (réellement dans ce repo)
- Portail client/public de logistique internationale.
- Cas centraux : **devis**, **expéditions**, **tracking**, **paiements**, **adresses**, **réservations**.
- Stack UI : Next.js (routes `pages/*`) + package partagé `@diaexpress/shared`.

## Principaux use cases identifiés
1. **Demande de devis en wizard** avec estimation tarifaire.
2. **Création devis** puis **conversion immédiate en expédition**.
3. **Suivi d’expédition** via code tracking public.
4. **Paiement d’un devis** (création paiement + confirmation quote payée).
5. **Gestion adresses** client (CRUD + géolocalisation).
6. **Réservation de départ** depuis dashboard public + consultation “mes réservations”.
7. **Pilotage admin** (devis, expéditions, pricing, users, schedules, external pricing) disponible dans le package partagé.

## Ce qui est complet vs partiel

### Complet (dans routes Next actives)
- Quote wizard + estimation.
- Quote → shipment.
- Tracking public.
- Quotes client + paiement.
- Shipments client.
- Adresses client.
- Réservations publiques + liste client.

### Partiel
- Cockpit admin : écrans présents, mais routes Next `/admin/*` non déclarées dans l’app racine.
- Paiement : UX présente, intégration PSP/webhooks non vérifiable ici (backend absent).
- Contrats API : coexistence de plusieurs conventions/fallbacks selon endpoints.

### Manquant / non vérifiable dans ce dépôt
- Backend source (controllers/services/models/middleware).
- Séparation explicite de rôles support/finance/opérations au-delà d’`admin`.
- Module dédié “embarkments/market points/countries” explicite.

## Top recommandations (priorité)
1. **Stabiliser auth + contrats API** (supprimer ambiguïtés d’endpoints).
2. **Activer les routes admin v2** déjà codées côté shared.
3. **Uniformiser workflow quote/paiement/statuts**.
4. **Relier planning/réservations au cockpit opérationnel**.
5. **Activer notifications UI + observabilité tracking**.

## Note importante
Le backend n’étant pas dans ce repo, cette synthèse décrit la vérité observable côté frontend + contrats API consommés.
