# Directive : GitHub

## Portée

Gestion du code source sur GitHub. Couvre : pousser des modifications, synchroniser sur une nouvelle machine, et déployer l'app en ligne via GitHub Pages.

---

## Repo de l'app Flashcards

| Élément | Valeur |
|---|---|
| Repo | `git@github.com:jeanbaptisteq/flashcards-unil.git` |
| Compte | `jeanbaptisteq` |
| Visibilité | Public |
| Dossier local | `.app/` |

---

## Opérations courantes

### Pousser un nouveau deck ou une modification

```bash
cd .app
git add public/data/<cours-id>/          # nouveaux fichiers JSON ou assets
git commit -m "Add deck: <cours> — <titre séance>"
git push
```

Exemples de messages de commit :
```
Add deck: controle-gestion — seance-3-budgets
Update deck: bia intro — add 3 cards
Fix: seance-2 explanation typo
```

### Vérifier l'état avant de commiter

```bash
cd .app
git status          # fichiers modifiés / non suivis
git diff            # voir les changements ligne par ligne
```

### Récupérer les dernières modifications (autre machine)

```bash
cd .app
git pull
npm install         # si package.json a changé
```

---

## Cloner sur une nouvelle machine

```bash
git clone git@github.com:jeanbaptisteq/flashcards-unil.git .app
cd .app
npm install
npm run dev
```

> Prérequis : avoir Node.js installé et une clé SSH configurée pour GitHub.

---

## Déployer l'app en ligne (GitHub Pages)

Pour rendre l'app accessible depuis n'importe quel navigateur sans `npm run dev`.

### Étape 1 — Configurer Vite pour le sous-chemin GitHub Pages

Dans `.app/vite.config.ts`, ajouter le `base` :

```ts
export default defineConfig({
  plugins: [react()],
  base: '/flashcards-unil/',
})
```

### Étape 2 — Installer `gh-pages`

```bash
cd .app
npm install --save-dev gh-pages
```

### Étape 3 — Ajouter le script dans `package.json`

```json
"scripts": {
  "deploy": "npm run build && gh-pages -d dist"
}
```

### Étape 4 — Déployer

```bash
npm run deploy
```

L'app sera accessible sur : `https://jeanbaptisteq.github.io/flashcards-unil/`

> Activer GitHub Pages dans les settings du repo : Settings → Pages → Source → `gh-pages` branch.

### Étape 5 — Valider le déploiement

```bash
gh api repos/jeanbaptisteq/flashcards-unil/pages --jq .status
```

Statuts attendus : `building` puis `built`.
Si `building`, attendre 30-90 secondes puis recharger l'URL avec cache-busting :

```text
https://jeanbaptisteq.github.io/flashcards-unil/?v=<timestamp>
```

### Correctif important : chemins `/data` et assets

Sur GitHub Pages, l'app est servie sous `/flashcards-unil/`.
Les appels `fetch('/data/...')` cassent en production (404).  
Règle : toujours préfixer les chemins avec `import.meta.env.BASE_URL`.

Implémentation actuelle :

- utilitaire : `.app/src/utils/paths.ts`
- types Vite : `.app/src/vite-env.d.ts`
- composants migrés : `HomeView`, `DeckListView`, `ReviewSession`, cartes (`image_front`, `image_back`, `image`)

Exemples :

```ts
fetch(dataUrl(`/data/${courseId}/index.json`))
fetch(dataUrl(`/data/${courseId}/${deck.file}`))
<img src={assetUrl(card.image_front)} />
```

---

## Ce qui est versionné / ignoré

| Inclus | Ignoré (`.gitignore`) |
|---|---|
| `src/` (code React) | `node_modules/` |
| `public/data/` (decks JSON + assets) | `dist/` (build) |
| `package.json`, `vite.config.ts` | `.DS_Store` |

> Les images dans `public/data/bia/assets/` sont incluses dans le repo car elles font partie du contenu des cartes.

---

## Cas limites

| Situation | Action |
|---|---|
| Push refusé (repo privé, SSH non configuré) | `gh auth login --web` puis réessayer |
| Conflits après `git pull` | Résoudre manuellement les fichiers JSON en conflit, puis `git add . && git commit` |
| Rollback d'un deck cassé | `git log --oneline`, puis `git checkout <hash> -- public/data/<cours>/<deck>.json` |
| Changer la visibilité du repo | `gh repo edit flashcards-unil --visibility public` (ou `--visibility private`) |
| GitHub Pages affiche `0 séances · 0 cartes` | Vérifier la console : si 404 sur `/data/...`, utiliser `dataUrl/assetUrl` (ne pas utiliser des chemins absolus `/data`) |
