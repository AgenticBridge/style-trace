# StyleTrace

[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Français | [Español](README.es.md)

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6)
![Playwright](https://img.shields.io/badge/browser-Playwright-45BA4B)
![MCP](https://img.shields.io/badge/protocol-MCP-6f42c1)
![npm downloads](https://img.shields.io/npm/dm/@agenticbridge/style-trace)

StyleTrace est un serveur MCP qui analyse des références et renvoie un brief de design directement exploitable dans un prompt, pour les agents et les personnes qui relisent le résultat. Un cas d’usage consiste à aider les développeurs à créer des sites sans être distraits par les décisions de design, puis à comparer le résultat généré avec les contraintes de style d’origine.

![StyleTrace reverse engineering comparison](docs/readme-example-1.png)

Exemple supplémentaire avec les mêmes références, comparant le flux avec et sans StyleTrace :

![StyleTrace with and without comparison](docs/readme-example-2.png)

## Pourquoi l’utiliser

- transformer quelques pages de référence, captures d’écran ou extraits HTML en un brief de design orienté prompt qu’un agent peut réellement utiliser
- rendre la régénération d’un site moins générique en conservant les éléments distinctifs
- relire du HTML généré ou des captures d’écran à partir des contraintes de style extraites, au lieu de se fier uniquement à un jugement visuel flou
- analyser uniquement les références que vous fournissez, pour garder un résultat prévisible et facile à relire

## Installation

Prérequis :

- Node.js `>=20`
- Playwright Chromium

Installation depuis npm :

```bash
npm install -g @agenticbridge/style-trace
npx playwright install chromium
```

Ou depuis un clone local :

```bash
npm install
npx playwright install chromium
npm run build
```

## Utilisation

Connectez-le depuis votre client MCP.

Package publié :

```json
{
  "mcpServers": {
    "style-trace": {
      "command": "npx",
      "args": ["-y", "@agenticbridge/style-trace"]
    }
  }
}
```

Clone local :

```json
{
  "mcpServers": {
    "style-trace": {
      "command": "node",
      "args": ["/absolute/path/to/style-trace/dist/src/index.js"]
    }
  }
}
```

Le serveur expose deux outils :

- `analyze_website_style`
- `review_generated_style`

`analyze_website_style` accepte des URL de sites exactes :

```json
{
  "urls": ["https://www.apple.com", "https://www.framer.com"],
  "targetArtifact": "landing-page",
  "fidelity": "high"
}
```

Il accepte aussi des références mixtes :

```json
{
  "references": [
    { "type": "url", "value": "https://www.apple.com/iphone/" },
    { "type": "image", "value": "https://example-cdn.com/reference/hero-shot.png" },
    { "type": "screenshot", "value": "https://example-cdn.com/reference/hero-capture.png" },
    { "type": "html", "value": "<main><section><h1>Hero</h1></section></main>" }
  ],
  "targetArtifact": "prototype",
  "fidelity": "medium",
  "designIntent": "preserve the hero hierarchy and chrome discipline",
  "evidenceMode": "inline"
}
```

`urls` reste pris en charge pour une entrée uniquement composée de sites web. Utilisez `references` lorsque vous voulez mélanger sites, images, captures d’écran et extraits HTML bornés dans une seule requête.

Le résultat inclut désormais des champs orientés prompt comme `visualVocabulary`, `styleInvariants`, `styleRisks`, `softGuesses`, `compositionBlueprint`, `variationAxes`, `blendModes`, `promptReadyBrief`, `reviewContract` et `originalityBoundary`.

`review_generated_style` compare du HTML généré ou une URL d’image générée avec un résultat StyleTrace :

```json
{
  "styleResult": { "...": "StyleTrace analyze_website_style output" },
  "generatedHtml": "<!doctype html><html>...</html>",
  "viewportWidth": 1440,
  "viewportHeight": 900
}
```

Il renvoie les contraintes respectées, celles qui sont violées, les signes de dérive, et un niveau de confiance pour la revue.

## Fonctionnement

`analyze_website_style` visite exactement les URL publiques que vous fournissez avec Playwright, et peut aussi analyser des URL d’images publiques directes, des captures d’écran et des extraits HTML bornés. Il extrait des signaux ciblés et faciles à relire, comme la structure des modules, le traitement du hero, les modèles de CTA, les sections de preuve, l’imagerie, les formulaires, les breakpoints et les motifs distinctifs, puis les compile dans un brief de design orienté prompt avec contraintes fortes, risques de dérive, structure de composition et vérifications de revue. Il ne parcourt pas d’autres pages et n’essaie pas d’inventer un nouveau design system ni de faire des recommandations spéculatives.

`review_generated_style` réanalyse l’artefact généré avec la même grille de lecture et le compare au contrat de style extrait. L’objectif est de rendre la revue de style explicite : ce qui correspond, ce qui dérive, et ce qui est devenu trop générique.

## Limites

- URL publiques `http` et `https` uniquement
- les références de type image et capture d’écran doivent pointer vers des assets image publics directs, comme `.png`, `.jpg`, `.webp`, `.gif`, `.avif` ou `.svg`
- les références HTML sont des extraits bornés, pas des sessions de navigation complètes
- les références image seules ou capture seules produisent des inférences plus faibles pour la typographie, la navigation, les formulaires, les animations et les breakpoints que des références de sites web vivants
- pas de flux d’authentification ni de cibles sur réseau privé
- transport stdio uniquement
- pas de persistance, de file d’attente ni d’interface web

## Contribution et tests

Lancer les vérifications locales :

```bash
npm run typecheck
npm run build
npm test
```

Pour un smoke test réel du transport MCP :

```bash
npm run test:mcp-cli
```

Pour le flux complet de revue avec captures source, régénération LLM `with MCP` vs `without MCP`, et tableau comparatif :

```bash
npm run test:e2e -- --instance apple-pixel-samsung
```

Autre jeu de comparaison intégré :

```bash
npm run test:e2e -- --instance figma-framer-webflow
```

Ou exécutez-le sur vos propres URL publiques :

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com https://www.framer.com
```

## Licence

MIT
