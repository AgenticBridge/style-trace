# StyleTrace

[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md) | Español

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6)
![Playwright](https://img.shields.io/badge/browser-Playwright-45BA4B)
![MCP](https://img.shields.io/badge/protocol-MCP-6f42c1)
![npm downloads](https://img.shields.io/npm/dm/@agenticbridge/style-trace)

StyleTrace es un servidor MCP que analiza referencias y devuelve un brief de diseño listo para usar en prompts, pensado para agentes y revisores. Un caso de uso es ayudar a los desarrolladores a crear sitios web sin distraerse con decisiones de diseño, y luego revisar el resultado generado contra las restricciones de estilo originales.

![StyleTrace reverse engineering comparison](docs/readme-example-1.png)

Ejemplo adicional con las mismas referencias, comparando el flujo con y sin StyleTrace:

![StyleTrace with and without comparison](docs/readme-example-2.png)

## Por qué usarlo

- convierte unas pocas páginas de referencia, capturas o fragmentos HTML en un brief de diseño orientado a prompts que un agente sí puede usar
- hace que la regeneración de sitios sea menos genérica al conservar las partes más distintivas
- permite revisar HTML generado o capturas contra las restricciones de estilo extraídas, en lugar de depender solo de una impresión visual vaga
- analiza solo las referencias que proporcionas, para que el resultado sea predecible y fácil de revisar

## Instalación

Requisitos:

- Node.js `>=20`
- Playwright Chromium

Instalación desde npm:

```bash
npm install -g @agenticbridge/style-trace
npx playwright install chromium
```

O ejecútalo desde un clon local:

```bash
npm install
npx playwright install chromium
npm run build
```

## Uso

Conéctalo desde tu cliente MCP.

Paquete publicado:

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

Clon local:

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

El servidor expone dos herramientas:

- `analyze_website_style`
- `review_generated_style`

`analyze_website_style` acepta URL exactas de sitios web:

```json
{
  "urls": ["https://www.apple.com", "https://www.framer.com"],
  "targetArtifact": "landing-page",
  "fidelity": "high"
}
```

También acepta referencias mixtas:

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

`urls` sigue funcionando para entradas solo de sitios web. Usa `references` cuando quieras mezclar sitios, imágenes, capturas y HTML acotado en una sola petición.

El resultado ahora incluye campos listos para prompts como `visualVocabulary`, `styleInvariants`, `styleRisks`, `softGuesses`, `compositionBlueprint`, `variationAxes`, `blendModes`, `promptReadyBrief`, `reviewContract` y `originalityBoundary`.

`review_generated_style` compara HTML generado o una URL de imagen generada contra un resultado de StyleTrace:

```json
{
  "styleResult": { "...": "StyleTrace analyze_website_style output" },
  "generatedHtml": "<!doctype html><html>...</html>",
  "viewportWidth": 1440,
  "viewportHeight": 900
}
```

Devuelve restricciones coincidentes, restricciones violadas, notas de deriva y un nivel de confianza para la revisión.

## Cómo funciona

`analyze_website_style` visita exactamente las URL públicas que proporcionas con Playwright, y también puede analizar URL directas de imágenes públicas, referencias de capturas y fragmentos HTML acotados. Extrae señales acotadas y fáciles de revisar, como la estructura de módulos, el tratamiento del hero, los patrones de CTA, los módulos de prueba social, la imaginería, los formularios, los breakpoints y los motivos distintivos, y luego las compila en un brief de diseño orientado a prompts con restricciones duras, riesgos de deriva, estructura de composición y comprobaciones de revisión. No rastrea páginas adicionales y no intenta inventar un nuevo sistema de diseño ni hacer recomendaciones especulativas.

`review_generated_style` vuelve a pasar el artefacto generado por la misma lente y lo compara con el contrato de estilo extraído. El objetivo es hacer explícita la revisión de estilo: qué coincide, qué se desvió y qué se volvió demasiado genérico.

## Límites

- solo URL públicas `http` y `https`
- las referencias de imagen y captura deben apuntar a recursos de imagen públicos directos, como `.png`, `.jpg`, `.webp`, `.gif`, `.avif` o `.svg`
- las referencias HTML son fragmentos acotados, no sesiones completas de navegación
- las referencias solo de imagen o solo de captura producen inferencias más débiles para tipografía, navegación, formularios, movimiento y breakpoints que las referencias de sitios vivos
- sin flujos de autenticación ni destinos de red privada
- solo transporte stdio
- sin persistencia, colas ni interfaz web

## Contribuir y probar

Ejecuta las comprobaciones locales:

```bash
npm run typecheck
npm run build
npm test
```

Para una prueba real del transporte MCP:

```bash
npm run test:mcp-cli
```

Para el flujo completo de revisión con capturas de origen, regeneración LLM `with MCP` vs `without MCP`, y un tablero comparativo:

```bash
npm run test:e2e -- --instance apple-pixel-samsung
```

Otro conjunto de comparación incorporado:

```bash
npm run test:e2e -- --instance figma-framer-webflow
```

O ejecútalo con tus propias URL públicas:

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com https://www.framer.com
```

## Licencia

MIT
