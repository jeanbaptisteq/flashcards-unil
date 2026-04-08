# Directive : Apprentissage cours Leadership (cours -> quiz -> examens -> flashcards)

## Portee

Cette directive s'applique a tous les sous-dossiers de :

- `ressources/Cours/Leadership/Cours/`

Objectif : standardiser le workflow d'apprentissage pour chaque cours du module Leadership.

---

## But

Pour chaque cours Leadership, produire un cycle complet :

1. Un markdown de cours propre et exploitable
2. Un fichier quiz associe (questions + reponses + explications)
3. Un enrichissement avec des questions pertinentes issues des anciens examens
4. Une integration de toutes les questions dans l'app de flashcards (`.app/`)

---

## Inputs

- Dossier des cours : `ressources/Cours/Leadership/Cours/`
- Dossier des examens : `ressources/Cours/Leadership/Examens/`
- App flashcards : `.app/public/data/leadership/`

---

## Outputs attendus (par cours)

- Fichier cours markdown (ex: `le_charisme.md`)
- Fichier quiz markdown (ex: `le_charisme_quiz.md`)
- Deck flashcards JSON (ex: `.app/public/data/leadership/charisme.json`)
- Index flashcards mis a jour (`.app/public/data/leadership/index.json`)

---

## Process standard (a executer pour chaque cours)

### 1) Construire/valider le markdown du cours

1. Identifier le dossier du cours cible dans `ressources/Cours/Leadership/Cours/`.
2. Verifier qu'un markdown de contenu existe deja (ex: `le_charisme.md`).
3. Si absent, le creer a partir de la source du cours (PDF/video/transcript) avec une structure claire :
   - titres de section
   - definitions clefs
   - concepts/tactiques
   - exemples et contre-exemples
4. Ne pas inventer de contenu : rester strictement fidele a la matiere.

### 2) Construire/mettre a jour le fichier quiz associe

1. Creer ou mettre a jour le fichier quiz du cours (ex: `le_charisme_quiz.md`).
2. Format recommande (coherent avec les quiz existants) :

```md
#### Question N

[Enonce] Vrai ou faux ?

**Reponse :** Vrai/Faux.

**Explication :** [justification concise basee sur le cours]
```

3. Ajouter les questions du quiz dans l'ordre, avec reponse et explication.
4. En cas de correction utilisateur (ex: capture d'ecran du quiz), prioriser la reponse validee et ajuster l'explication.

### 3) Enrichir avec des questions pertinentes des anciens examens

1. Parcourir les examens dans `ressources/Cours/Leadership/Examens/`.
2. Extraire les questions proches des themes du cours (ex: pour Charisme :
   repetition, contraste, metaphore/comparaison, conviction morale, sentiment collectif, objectifs ambitieux, etc.).
3. Ajouter ces questions au fichier quiz du cours, avec :
   - formulation claire
   - reponse attendue
   - explication alignee avec cours + logique d'examen
4. Prioriser la pertinence thematique plutot que la quantite.

### 4) Integrer tout le quiz dans l'app de flashcards

1. Creer un deck dedie :
   - chemin : `.app/public/data/leadership/<deck-id>.json`
   - exemple : `.app/public/data/leadership/charisme.json`
2. Convertir chaque question du quiz en carte `mcq_single` :
   - options : `Vrai` / `Faux`
   - `correct` : `A` ou `B`
   - `explanation` : reprise concise de l'explication du quiz
3. Mettre a jour `.app/public/data/leadership/index.json` pour referencer le nouveau deck.
4. Valider les JSON :
   - `python3 -m json.tool .app/public/data/leadership/<deck-id>.json`
   - `python3 -m json.tool .app/public/data/leadership/index.json`

---

## Convention de nommage

- Cours : `le_<theme>.md`
- Quiz : `le_<theme>_quiz.md`
- Deck flashcards : `<theme>.json` (kebab-case ou slug simple coherent)
- Deck id dans `index.json` == nom du fichier sans `.json`

---

## Regles qualite

- Fidelite stricte au contenu du cours et aux examens
- Explications courtes, precises, verifiables
- Pas de doublons de questions
- Coherence terminologique entre cours, quiz et flashcards
- JSON valide avant cloture

---

## Checklist finale (par cours)

- [ ] Markdown de cours present et exploitable
- [ ] Quiz complet avec reponses + explications
- [ ] Questions pertinentes des examens ajoutees
- [ ] Deck flashcards cree et reference dans `index.json`
- [ ] Validation JSON OK
