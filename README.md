### Consignes JS:

- Si probleme de version pnpm, utiliser `corepack enable pnpm` qui devrait automatiquement utiliser la bonne version
- Ne pas modifier les classes qui ont un commentaire: `// WARN: Should not be changed during the exercise
`
- Pour lancer les tests: `pnpm test`
  - integration only in watch mode `pnpm test:integration`
  - unit only in watch mode `pnpm test:unit`

---

## Architecture

Le traitement d'une commande traverse quatre couches. Chaque couche ne connaît que
la suivante, et une seule couche parle à la base de données.

| Couche | Emplacement | Responsabilité |
| --- | --- | --- |
| HTTP | `src/controllers/order.controller.ts` | Valider la requête, déléguer, traduire le résultat (200 / 400 / 404). Aucune règle métier. |
| Application | `src/services/orders/order.service.ts` | Charger la commande, faire traiter chacun de ses produits. |
| Domaine | `src/services/products/` | Les règles de disponibilité, un *handler* par type de produit. |
| Persistance | `src/repositories/` | Le seul endroit qui importe `drizzle-orm`. |
| Port sortant | `src/services/notifications.port.ts` | Les notifications clients (implémentation figée par l'exercice). |

### Ajouter un type de produit

1. Ajouter la valeur dans `PRODUCT_TYPES` (`src/db/schema.ts`).
2. Créer un handler dans `src/services/products/handlers/` implémentant `ProductHandler`.
3. L'enregistrer dans `src/di/di.context.ts` et dans la table de `ProductService`.

TypeScript signale l'étape 3 si elle est oubliée : la table des handlers est un
`Record<ProductType, ProductHandler>`, donc exhaustive à la compilation.

## Tests

- **Unitaires** (`pnpm test:unit`) — un fichier par handler, sans base de données :
  les dépendances passent par des mocks. ~2 ms par fichier.
- **Intégration** (`pnpm test:integration`) — la vraie application via HTTP, base
  SQLite créée et détruite à chaque test, service de notification mocké.

Les tests d'intégration ont été écrits **avant** le refactoring, au niveau HTTP,
pour servir de filet : ils couvrent chaque cas métier des trois types de produits
et n'ont pas changé d'une ligne pendant la restructuration.

## Changements de comportement assumés

Un seul, volontaire : une commande inconnue renvoyait **500** (déréférencement d'un
`undefined`), elle renvoie maintenant **404**. Un `orderId` non entier positif
renvoie **400**. Tout le reste est iso-fonctionnel.
