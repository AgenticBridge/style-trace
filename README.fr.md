# StyleTrace

[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Français | [Español](README.es.md)

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6)
![Playwright](https://img.shields.io/badge/browser-Playwright-45BA4B)
![MCP](https://img.shields.io/badge/protocol-MCP-6f42c1)
![npm downloads](https://img.shields.io/npm/dm/@agenticbridge/style-trace)

StyleTrace est un serveur MCP qui analyse des sites web et renvoie une grammaire de design compacte pour les agents et les personnes qui relisent le résultat. Un cas d’usage consiste à aider les développeurs à créer des sites sans être distraits par les décisions de design.

![StyleTrace reverse engineering comparison](docs/readme-style-reverse-engineering.png)

## Pourquoi l’utiliser

- transformer quelques pages de référence en une grammaire de design claire qu’un agent peut réellement utiliser
- rendre la régénération d’un site moins générique en conservant les éléments distinctifs
- analyser uniquement les URL que vous fournissez, pour garder un résultat prévisible et facile à relire

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

Le serveur expose un seul outil : `analyze_website_style`.

Exemple d’entrée :

```json
{
  "urls": ["https://www.apple.com", "https://www.framer.com"]
}
```

## Fonctionnement

StyleTrace visite exactement les URL publiques que vous fournissez avec Playwright. Il extrait des signaux ciblés et faciles à relire, comme la structure des modules, le traitement du hero, les modèles de CTA, les sections de preuve, l’imagerie, les formulaires, les breakpoints et les motifs distinctifs. Il ne parcourt pas d’autres pages et n’essaie pas d’inventer un nouveau design system ni de faire des recommandations spéculatives.

## Limites

- URL publiques `http` et `https` uniquement
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

Ou exécutez-le sur vos propres URL publiques :

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com https://www.framer.com
```

## Licence

MIT
