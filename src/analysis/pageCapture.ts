import type { Page } from "playwright";
import type { PageSnapshot } from "../core/types.js";
import { settleLoadedPage } from "./pageReadiness.js";

export async function dismissConsentOverlays(page: Page): Promise<void> {
  const selectors = [
    "button:has-text('Accept')",
    "button:has-text('Accept all')",
    "button:has-text('I agree')",
    "button:has-text('Got it')",
    "button:has-text('Allow all')",
  ];

  for (const selector of selectors) {
    const button = page.locator(selector).first();
    try {
      if (await button.isVisible({ timeout: 400 })) {
        await button.click({ timeout: 1000 });
        return;
      }
    } catch {
      continue;
    }
  }
}

export async function capturePageSnapshot(page: Page): Promise<PageSnapshot> {
  const snapshot = await page.evaluate(() => {
    const bodyStyle = getComputedStyle(document.body);
    const toNumber = (value: string) => Number.parseFloat(value) || 0;
    const clampText = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 160);
    const medianValue = (values: number[]) => {
      if (values.length === 0) {
        return 0;
      }
      const sorted = [...values].sort((left, right) => left - right);
      const middle = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return (sorted[middle - 1]! + sorted[middle]!) / 2;
      }
      return sorted[middle]!;
    };
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const headings = Array.from(document.querySelectorAll("h1, h2, h3")).slice(0, 18).map((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        tagName: element.tagName.toLowerCase(),
        text: clampText(element.textContent ?? ""),
        top: Math.max(0, rect.top + window.scrollY),
        fontSize: toNumber(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
        fontFamily: style.fontFamily,
      };
    }).filter((item) => item.text.length > 0);

    const actions = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']")).slice(0, 28).map((element) => {
      const target = element as HTMLElement;
      const style = getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      const region: "nav" | "header" | "footer" | "main" | "other" = target.closest("nav")
        ? "nav"
        : target.closest("header")
          ? "header"
          : target.closest("footer")
            ? "footer"
            : target.closest("main")
              ? "main"
              : "other";
      return {
        tagName: target.tagName.toLowerCase(),
        text: clampText(target.innerText || target.getAttribute("value") || target.textContent || ""),
        top: Math.max(0, rect.top + window.scrollY),
        region,
        backgroundColor: style.backgroundColor,
        textColor: style.color,
        borderColor: style.borderColor,
        borderRadius: toNumber(style.borderTopLeftRadius),
        fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
        paddingX: toNumber(style.paddingLeft) + toNumber(style.paddingRight),
        paddingY: toNumber(style.paddingTop) + toNumber(style.paddingBottom),
      };
    }).filter((item) => item.text.length > 0);

    const internalLinks = Array.from(document.querySelectorAll("a[href]")).slice(0, 120).map((anchor) => {
      const href = (anchor as HTMLAnchorElement).href;
      const text = clampText(anchor.textContent ?? "");
      const region: "nav" | "header" | "footer" | "main" | "other" = anchor.closest("nav")
        ? "nav"
        : anchor.closest("header")
          ? "header"
          : anchor.closest("footer")
            ? "footer"
            : anchor.closest("main")
              ? "main"
              : "other";

      return { href, text, region };
    });

    const navLinkTexts = Array.from(document.querySelectorAll("nav a[href], header a[href]")).map((anchor) => clampText(anchor.textContent ?? "")).filter(Boolean).slice(0, 16);
    const footerLinkTexts = Array.from(document.querySelectorAll("footer a[href]")).map((anchor) => clampText(anchor.textContent ?? "")).filter(Boolean).slice(0, 20);

    const sectionCandidates = Array.from(document.querySelectorAll("main section, main > div, [data-section], article, [role='region']")).slice(0, 36).flatMap((element) => {
      const target = element as HTMLElement;
      const rect = target.getBoundingClientRect();
      const top = Math.max(0, rect.top + window.scrollY);
      const height = Math.round(rect.height);
      const width = Math.round(rect.width);
      if (height < 120 || rect.width < 260) {
        return [];
      }

      const text = clampText((target.innerText || target.textContent || "").toLowerCase()).slice(0, 400);
      if (text.length < 24) {
        return [];
      }

      const sectionHeadings = Array.from(target.querySelectorAll("h1, h2, h3")).slice(0, 6).map((heading) => {
        const headingElement = heading as HTMLElement;
        const style = getComputedStyle(headingElement);
        const headingRect = headingElement.getBoundingClientRect();
        return {
          tag: heading.tagName.toLowerCase(),
          text: clampText(headingElement.innerText || headingElement.textContent || ""),
          size: toNumber(style.fontSize),
          textAlign: style.textAlign,
          centerOffset: Math.abs((headingRect.left + (headingRect.width / 2)) - (viewportWidth / 2)),
        };
      }).filter((heading) => heading.text.length > 0);

      const candidateActions = Array.from(target.querySelectorAll("button, a, input[type='button'], input[type='submit']")).slice(0, 12).map((action) => {
        const actionElement = action as HTMLElement;
        const style = getComputedStyle(actionElement);
        return {
          text: clampText(actionElement.innerText || actionElement.textContent || actionElement.getAttribute("value") || ""),
          paddingX: toNumber(style.paddingLeft) + toNumber(style.paddingRight),
          backgroundColor: style.backgroundColor,
        };
      }).filter((action) => action.text.length > 0);

      const primaryActionCount = candidateActions.filter((action) => {
        const color = action.backgroundColor.toLowerCase();
        return color !== "transparent" && color !== "rgba(0, 0, 0, 0)" && color !== "rgb(0, 0, 0)" && action.paddingX >= 20;
      }).length;

      const cardCount = Math.max(
        target.querySelectorAll("li, article, [class*='card'], [class*='tile'], [data-card]").length,
        Math.round(target.querySelectorAll("img, picture, svg").length / 2),
      );
      const mediaElements = Array.from(target.querySelectorAll("img, picture, video, canvas, svg, iframe")).slice(0, 12);
      const mediaCount = mediaElements.length;
      const largeMediaCount = mediaElements.filter((media) => {
        const mediaRect = (media as HTMLElement).getBoundingClientRect();
        return mediaRect.width >= 280 && mediaRect.height >= 180;
      }).length;
      const mediaArea = mediaElements.reduce((sum, media) => {
        const mediaRect = (media as HTMLElement).getBoundingClientRect();
        return sum + Math.max(0, mediaRect.width) * Math.max(0, mediaRect.height);
      }, 0);
      const logoLikeCount = target.querySelectorAll("img[alt*='logo' i], svg[aria-label*='logo' i], [class*='logo'] img").length;
      const textBlocks = Array.from(target.querySelectorAll("p, li, h1, h2, h3, span, small")).slice(0, 24).map((element) => {
        const textElement = element as HTMLElement;
        const elementText = clampText(textElement.innerText || textElement.textContent || "");
        if (elementText.length < 20) {
          return null;
        }
        const textStyle = getComputedStyle(textElement);
        const textRect = textElement.getBoundingClientRect();
        return {
          textAlign: textStyle.textAlign,
          centerOffset: Math.abs((textRect.left + (textRect.width / 2)) - (viewportWidth / 2)),
        };
      }).filter((value): value is { textAlign: string; centerOffset: number } => value !== null);
      const centeredTextCount = textBlocks.filter((block) => block.textAlign === "center" || block.centerOffset <= viewportWidth * 0.1).length
        + sectionHeadings.filter((heading) => heading.textAlign === "center" || heading.centerOffset <= viewportWidth * 0.1).length;
      const leftAlignedTextCount = textBlocks.filter((block) => block.textAlign === "left" || block.textAlign === "start").length
        + sectionHeadings.filter((heading) => heading.textAlign === "left" || heading.textAlign === "start").length;
      const sectionStyle = getComputedStyle(target);
      const backgroundColor = sectionStyle.backgroundColor;
      const sectionArea = Math.max(1, width * height);
      const viewportCoverage = Number(Math.min(1, (height * width) / Math.max(1, viewportHeight * viewportWidth)).toFixed(2));
      const mediaAreaRatio = Number(Math.min(1, mediaArea / sectionArea).toFixed(2));

      const labels = new Set<string>();
      const headingText = sectionHeadings[0]?.text ?? "";
      const headingTag = sectionHeadings[0]?.tag ?? "div";
      const headingSize = Math.max(...sectionHeadings.map((heading) => heading.size), 0);
      const aboveFold = top <= viewportHeight * 1.2;

      if (aboveFold && (headingTag === "h1" || headingSize >= 40 || (sectionHeadings.length > 0 && primaryActionCount >= 1))) {
        labels.add("hero");
      }

      if (
        /trusted|customer|testimonial|review|loved by|case stud|award|recognized|used by|social proof/.test(text)
        || logoLikeCount >= 3
      ) {
        labels.add("proof");
      }

      if (
        /pricing|plans|plan|buy|purchase|starting at|per month|per year|from \$/.test(text)
        || (cardCount >= 3 && /month|year|annual|monthly/.test(text))
      ) {
        labels.add("pricing");
      }

      if (
        /feature|capabilit|benefit|why |powerful|everything you need|designed to|works with/.test(text)
        || (cardCount >= 3 && sectionHeadings.length >= 2)
      ) {
        labels.add("features");
      }

      if (
        /get started|book demo|start free|talk to sales|request demo|buy|shop now|learn more|pre-order/.test(text)
        || primaryActionCount >= 2
      ) {
        labels.add("cta");
      }

      return [{
        top,
        height,
        width,
        headingText,
        headingTag,
        headingSize,
        headingCount: sectionHeadings.length,
        actionCount: candidateActions.length,
        primaryActionCount,
        cardCount,
        logoLikeCount,
        mediaCount,
        largeMediaCount,
        textLength: text.length,
        backgroundColor,
        textBlockCount: textBlocks.length,
        centeredTextCount,
        leftAlignedTextCount,
        mediaAreaRatio,
        viewportCoverage,
        labels: [...labels],
      }];
    });

    const sectionHints = sectionCandidates.flatMap((candidate) => candidate.labels.map((label) => ({ label, top: candidate.top })));

    const widthSamples = Array.from(document.querySelectorAll("main section, main > div, header > div, footer > div")).slice(0, 32).map((element) => {
      const rect = element.getBoundingClientRect();
      return Math.round(rect.width);
    }).filter((width) => width > 320);

    const mediaElements = Array.from(document.querySelectorAll("img, picture, video, canvas, svg")).slice(0, 120);
    const iconCount = mediaElements.filter((element) => {
      const rect = (element as HTMLElement).getBoundingClientRect();
      return rect.width <= 64 && rect.height <= 64;
    }).length;
    const photoLikeMediaCount = mediaElements.filter((element) => {
      const rect = (element as HTMLElement).getBoundingClientRect();
      return (element.tagName.toLowerCase() === "img" || element.tagName.toLowerCase() === "picture") && rect.width >= 220 && rect.height >= 140;
    }).length;
    const videoCount = document.querySelectorAll("video, iframe").length;
    const illustrationLikeCount = mediaElements.filter((element) => {
      const tag = element.tagName.toLowerCase();
      const rect = (element as HTMLElement).getBoundingClientRect();
      return (tag === "svg" || tag === "canvas") && rect.width >= 80 && rect.height >= 80;
    }).length;

    const motionElements = Array.from(document.querySelectorAll("a, button, input, [class], [style]")).slice(0, 160).map((element) => {
      const target = element as HTMLElement;
      const style = getComputedStyle(target);
      return {
        animationDuration: toNumber(style.animationDuration),
        transitionDuration: toNumber(style.transitionDuration),
        position: style.position,
        cursor: style.cursor,
      };
    });
    const animatedElementCount = motionElements.filter((item) => item.animationDuration > 0.01).length;
    const transitionElementCount = motionElements.filter((item) => item.transitionDuration > 0.01).length;
    const stickyElementCount = motionElements.filter((item) => item.position === "sticky" || item.position === "fixed").length;
    const hoverableActionCount = motionElements.filter((item) => item.cursor === "pointer" && item.transitionDuration > 0.01).length;

    const formFields = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, select")).slice(0, 40).map((field) => {
      const target = field as HTMLElement;
      const style = getComputedStyle(target);
      const tag = field.tagName.toLowerCase();
      const fieldId = (field as HTMLInputElement).id;
      const label = fieldId ? document.querySelector(`label[for="${CSS.escape(fieldId)}"]`) : field.closest("label");
      const bg = style.backgroundColor.toLowerCase();
      const border = style.borderColor.toLowerCase();
      const filled = bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)" && bg !== "rgb(0, 0, 0)";
      const outlined = border !== "transparent" && border !== "rgba(0, 0, 0, 0)";
      return {
        tag,
        labeled: Boolean(label),
        required: (field as HTMLInputElement).required === true || target.getAttribute("aria-required") === "true",
        radius: toNumber(style.borderTopLeftRadius),
        filled,
        outlined,
      };
    });
    const filledFieldCount = formFields.filter((field) => field.filled).length;
    const outlinedFieldCount = formFields.filter((field) => field.outlined).length;
    const fieldStyle: PageSnapshot["formSignals"]["fieldStyle"] = formFields.length === 0
      ? "none"
      : filledFieldCount === formFields.length
        ? "filled"
        : outlinedFieldCount === formFields.length
          ? "outlined"
          : "mixed";

    return {
      path: window.location.pathname || "/",
      url: window.location.href,
      title: document.title,
      viewportWidth,
      viewportHeight,
      bodyBackgroundColor: bodyStyle.backgroundColor,
      bodyTextColor: bodyStyle.color,
      bodyFontFamily: bodyStyle.fontFamily,
      bodyFontSize: toNumber(bodyStyle.fontSize),
      pageHeight: document.documentElement.scrollHeight,
      textLength: (document.body.innerText || "").replace(/\s+/g, " ").trim().length,
      navLinkTexts,
      footerLinkTexts,
      internalLinks,
      headings,
      actions,
      sectionHints,
      sectionCandidates,
      widthSamples,
      imagerySignals: {
        iconCount,
        photoLikeMediaCount,
        videoCount,
        illustrationLikeCount,
      },
      interactionSignals: {
        animatedElementCount,
        transitionElementCount,
        stickyElementCount,
        hoverableActionCount,
      },
      formSignals: {
        formCount: document.querySelectorAll("form").length,
        inputCount: document.querySelectorAll("input:not([type='hidden'])").length,
        textareaCount: document.querySelectorAll("textarea").length,
        selectCount: document.querySelectorAll("select").length,
        labeledFieldCount: formFields.filter((field) => field.labeled).length,
        requiredFieldCount: formFields.filter((field) => field.required).length,
        fieldRadiusMedian: medianValue(formFields.map((field) => field.radius)),
        fieldStyle,
      },
      responsiveProbe: {
        mobileViewportWidth: 390,
        mobileNavLinkCount: 0,
        mobilePrimaryActionCount: 0,
        mobileMenuTriggerCount: 0,
        mobileMultiColumnSectionCount: 0,
        navCollapseRatio: 0,
      },
    };
  });
  const responsiveProbe = await captureResponsiveProbe(page);
  return {
    ...snapshot,
    responsiveProbe,
  };
}

async function captureResponsiveProbe(page: Page): Promise<PageSnapshot["responsiveProbe"]> {
  const originalViewport = page.viewportSize() ?? { width: 1440, height: 900 };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
  await settleLoadedPage(page, { dismissOverlays: dismissConsentOverlays });
  const probe = await page.evaluate(() => {
    const toNumber = (value: string) => Number.parseFloat(value) || 0;
    const navLinks = Array.from(document.querySelectorAll("nav a[href], header a[href]"))
      .filter((element) => {
        const rect = (element as HTMLElement).getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    const mobilePrimaryActionCount = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']"))
      .filter((element) => {
        const target = element as HTMLElement;
        const style = getComputedStyle(target);
        const paddingX = toNumber(style.paddingLeft) + toNumber(style.paddingRight);
        return style.backgroundColor !== "rgba(0, 0, 0, 0)" && paddingX >= 20;
      }).length;
    const mobileMenuTriggerCount = Array.from(document.querySelectorAll("button, [role='button'], summary"))
      .filter((element) => /menu|open|navigation|nav|drawer/i.test((element.textContent || "") + " " + ((element as HTMLElement).getAttribute("aria-label") || ""))).length;
    const mobileMultiColumnSectionCount = Array.from(document.querySelectorAll("main section, main > div"))
      .filter((element) => {
        const style = getComputedStyle(element as HTMLElement);
        return (/grid/.test(style.display) && /,/.test(style.gridTemplateColumns)) || (/flex/.test(style.display) && style.flexDirection === "row");
      }).length;
    return {
      mobileViewportWidth: window.innerWidth,
      mobileNavLinkCount: navLinks.length,
      mobilePrimaryActionCount,
      mobileMenuTriggerCount,
      mobileMultiColumnSectionCount,
    };
  });
  await page.setViewportSize(originalViewport);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
  await settleLoadedPage(page, { dismissOverlays: dismissConsentOverlays });
  return {
    ...probe,
    navCollapseRatio: Number((probe.mobileNavLinkCount / Math.max(1, 8)).toFixed(2)),
  };
}
