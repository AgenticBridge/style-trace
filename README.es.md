# StyleTrace

[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md) | Español

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6)
![Playwright](https://img.shields.io/badge/browser-Playwright-45BA4B)
![MCP](https://img.shields.io/badge/protocol-MCP-6f42c1)
![npm downloads](https://img.shields.io/npm/dm/@agenticbridge/style-trace)

StyleTrace es un servidor MCP que analiza sitios web y devuelve una gramática de diseño compacta para agentes y revisores. Un caso de uso es ayudar a los desarrolladores a crear sitios web sin distraerse con decisiones de diseño.

![StyleTrace reverse engineering comparison](docs/readme-style-reverse-engineering.png)

## Por qué usarlo

- convierte unas pocas páginas de referencia en una gramática de diseño clara que un agente sí puede usar
- hace que la regeneración de sitios sea menos genérica al conservar las partes más distintivas
- analiza solo las URL que proporcionas, para que el resultado sea predecible y fácil de revisar

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

El servidor expone una sola herramienta: `analyze_website_style`.

Ejemplo de entrada:

```json
{
  "urls": ["https://www.apple.com", "https://www.framer.com"]
}
```

## Cómo funciona

StyleTrace visita exactamente las URL públicas que proporcionas con Playwright. Extrae señales acotadas y fáciles de revisar, como la estructura de módulos, el tratamiento del hero, los patrones de CTA, los módulos de prueba social, la imaginería, los formularios, los breakpoints y los motivos distintivos. No rastrea páginas adicionales y no intenta inventar un nuevo sistema de diseño ni hacer recomendaciones especulativas.

## Límites

- solo URL públicas `http` y `https`
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

O ejecútalo con tus propias URL públicas:

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com https://www.framer.com
```

## Licencia

MIT
