# Fiche - Manhwa (système) — `manhwa-sheet`

Système Foundry VTT v13 au centre de la suite : fiche de personnage, d'objet et de créature, Menu de jeu (groupe, quêtes, guilde, courrier, annonces, téléphone, carnet, wiki…) et **toutes les données partagées** de la suite (Groupes MJ, saisons, classes, catégories d'objets, cosmétiques, réglages communs). Point d'entrée : `scripts/manhwa.js`.

La documentation détaillée du module est dans `DOCUMENTATION.md`.

Code de la version **1.66.5** (dernière release), pour Foundry VTT v13.

## Liens avec la suite Manhwa

La suite compte un système (Fiche - Manhwa) et 11 modules. La Fiche est le centre : les données partagées y vivent et les modules les lisent via `globalThis.MANHWA`.

- **Fournit à tous** l'API `globalThis.MANHWA` et les hooks `manhwaGmGroups`, `manhwaSeason`, `manhwaSeasonEvents`, `manhwaClasses`, `manhwaMenuCfg`, `manhwaSheetReady`.
- Groupes MJ → Carte Stellaire, Horlogia, Portrait, Scénarios, Boutique. Saisons → Horlogia, Boutique, Gacha. Catégories / config → Boutique, Transfert, Scénarios. Sélecteurs de destinataires → Gacha, Domaine.
- Pose le thème commun `body[data-ms-theme]` utilisé par l'Interface et toute la direction artistique.
- Utilise, s'ils sont actifs : Horlogia (saison, fêtes du jour ; écoute `horlogiaChange`), la Boutique, les Notifications (montées de niveau).
- Règle commune : un module ne plante jamais si un autre est absent (vérifier `game.modules.get(id)?.active` avant d'appeler son API).

## Livraison

1. Augmenter `version` dans `system.json` (jamais deux livraisons au même numéro).
2. Construire le zip, qui doit contenir le dossier `manhwa-sheet/` :
   ```bash
   mkdir -p build/manhwa-sheet && git archive HEAD | tar -x -C build/manhwa-sheet
   cd build && zip -qr manhwa-sheet.zip manhwa-sheet
   ```
3. Créer la release GitHub `vX.Y.Z` avec **exactement 2 fichiers** : `system.json` et `manhwa-sheet.zip`. Le manifeste pointe vers `releases/latest/download/…`.
4. The Forge : Bazaar → *Install From Manifest* avec l'URL versionnée `https://github.com/blendbastien/manhwa-sheet/releases/download/vX.Y.Z/system.json`. Ne jamais utiliser *Update All Packages*.
5. Redémarrer le monde de test, vérifier la version installée et tester.
