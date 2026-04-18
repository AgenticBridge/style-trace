# StyleTrace

[English](README.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | 한국어 | [Français](README.fr.md) | [Español](README.es.md)

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6)
![Playwright](https://img.shields.io/badge/browser-Playwright-45BA4B)
![MCP](https://img.shields.io/badge/protocol-MCP-6f42c1)
![npm downloads](https://img.shields.io/npm/dm/@agenticbridge/style-trace)

StyleTrace는 웹사이트를 분석하고 에이전트와 리뷰어를 위한 간결한 디자인 문법을 반환하는 MCP 서버입니다. 한 가지 대표적인 사용 사례는 개발자가 디자인 결정에 덜 방해받으면서 웹사이트를 만드는 데 도움을 주는 것입니다.

![StyleTrace reverse engineering comparison](docs/readme-style-reverse-engineering.png)

## 왜 사용하나요

- 몇 개의 참고 페이지를 에이전트가 실제로 사용할 수 있는 명확한 디자인 문법으로 바꿉니다
- 눈에 띄는 특징을 유지해서 생성된 사이트가 너무 평범해지는 것을 줄여줍니다
- 사용자가 준 URL만 분석하므로 결과가 예측 가능하고 검토하기 쉽습니다

## 설치

요구 사항:

- Node.js `>=20`
- Playwright Chromium

npm 설치:

```bash
npm install -g @agenticbridge/style-trace
npx playwright install chromium
```

로컬 클론에서 실행:

```bash
npm install
npx playwright install chromium
npm run build
```

## 사용법

MCP 클라이언트에서 연결해서 사용하세요.

배포된 패키지:

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

로컬 클론:

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

서버는 하나의 도구만 제공합니다: `analyze_website_style`.

입력 예시:

```json
{
  "urls": ["https://www.apple.com", "https://www.framer.com"]
}
```

## 작동 방식

StyleTrace는 사용자가 제공한 공개 URL만 Playwright로 방문합니다. 모듈 구조, hero 처리 방식, CTA 패턴, 사회적 증거 영역, 이미지, 폼, 브레이크포인트, 시그니처 모티프 같은 좁고 검토 가능한 신호를 추출합니다. 추가 페이지를 크롤링하지 않으며, 새로운 디자인 시스템을 임의로 만들거나 추측성 제안을 하지 않습니다.

## 제한 사항

- 공개 `http` 및 `https` URL만 지원
- 인증 플로우 및 사설 네트워크 대상은 지원하지 않음
- stdio transport만 지원
- 영속성, 큐, 웹 UI 없음

## 기여 및 테스트

로컬 검사:

```bash
npm run typecheck
npm run build
npm test
```

실제 MCP transport 스모크 테스트:

```bash
npm run test:mcp-cli
```

소스 캡처, `with MCP` / `without MCP` LLM 재생성, 비교 보드까지 포함한 전체 리뷰 흐름:

```bash
npm run test:e2e -- --instance apple-pixel-samsung
```

또는 직접 공개 URL로 실행:

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com https://www.framer.com
```

## 라이선스

MIT
