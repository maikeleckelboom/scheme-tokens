// ADR 0013 D7 in real engines: computed custom properties for the generated activation CSS.
// Each case renders the built exporter's output, so it proves the shipped artifact.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type * as SchemeTokens from "scheme-tokens";

const distEntry = fileURLToPath(new URL("../../dist/index.js", import.meta.url));
let api: typeof SchemeTokens;

test.beforeAll(async () => {
  if (!existsSync(distEntry)) {
    throw new Error("Build the package before the browser suite: pnpm build.");
  }
  api = (await import(pathToFileURL(distEntry).href)) as typeof SchemeTokens;
});

// Deterministic stand-ins for a system preference; the viewport is wider than one pixel.
const ALWAYS = "(min-width: 1px)";
const NEVER = "(max-width: 1px)";
const PREFERS_DARK = "(prefers-color-scheme: dark)";

type Mode = "light" | "dark";

/** Export a two-mode scheme whose `--surface` value names the active mode. */
function tokensCss(
  options: SchemeTokens.ExportCssVarsOptions<string, Mode> = {},
  modes: readonly [Mode, Mode] = ["light", "dark"],
): string {
  const graph = api.defineTokenGraph({
    modes,
    defaultMode: "light",
    tokens: {
      surface: { light: "light", dark: "dark" },
      accent: "shared",
      "color-scheme": { light: "light", dark: "dark" },
    },
  });
  const css = api.orThrow(
    api.exportCssVars(api.orThrow(api.compileTokenGraph(graph)), options),
  ).css;
  expect(css).not.toContain("important");
  return css;
}

interface Scenario {
  readonly before?: string;
  readonly tokens: string;
  readonly after?: string;
  readonly root?: Readonly<Record<string, string>>;
  readonly body?: string;
}

async function render(page: Page, scenario: Scenario): Promise<void> {
  const styles = [scenario.before, scenario.tokens, scenario.after]
    .filter((style) => style !== undefined)
    .map((style) => `<style>${style}</style>`)
    .join("");
  await page.setContent(
    `<!doctype html><html><head>${styles}</head><body>${scenario.body ?? ""}</body></html>`,
  );
  await page.evaluate((attributes) => {
    for (const [name, value] of Object.entries(attributes)) {
      document.documentElement.setAttribute(name, value);
    }
  }, scenario.root ?? {});
}

/** Computed values by element id; `root` is the document element. */
async function read(
  page: Page,
  ids: readonly string[],
  property = "--surface",
): Promise<readonly string[]> {
  return page.evaluate(
    ({ ids, property }) =>
      ids.map((id) => {
        const element = id === "root" ? document.documentElement : document.getElementById(id);
        if (element === null) {
          throw new Error(`missing #${id}`);
        }
        const style = getComputedStyle(element);
        return property === "color-scheme"
          ? style.colorScheme
          : style.getPropertyValue(property).trim();
      }),
    { ids, property },
  );
}

function island(outer: Mode, inner: Mode): string {
  return (
    `<section id="section" data-theme="${outer}"><p id="plain"></p>` +
    `<div id="island" data-theme="${inner}"><p id="deep"></p></div></section>`
  );
}

test("base applies the default mode at the root", async ({ page }) => {
  await render(page, { tokens: tokensCss({ attribute: false }), body: '<p id="child"></p>' });
  expect(await read(page, ["root", "child"])).toEqual(["light", "light"]);
});

test("a matching system condition beats base; a non-matching one leaves base", async ({ page }) => {
  await render(page, { tokens: tokensCss({ system: { dark: ALWAYS } }) });
  expect(await read(page, ["root"])).toEqual(["dark"]);
  await render(page, { tokens: tokensCss({ system: { dark: NEVER } }) });
  expect(await read(page, ["root"])).toEqual(["light"]);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`the system tier follows an emulated ${colorScheme} preference`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await render(page, {
      tokens: tokensCss({ system: { dark: PREFERS_DARK } }),
      body: '<p id="child"></p>',
    });
    expect(await read(page, ["root", "child"])).toEqual([colorScheme, colorScheme]);
  });
}

test("explicit markers beat an active system condition in both directions", async ({ page }) => {
  await render(page, {
    tokens: tokensCss({ system: { dark: ALWAYS } }),
    root: { "data-theme": "light" },
  });
  expect(await read(page, ["root"])).toEqual(["light"]);
  await render(page, {
    tokens: tokensCss({ system: { light: ALWAYS, dark: NEVER } }),
    root: { "data-theme": "dark" },
  });
  expect(await read(page, ["root"])).toEqual(["dark"]);

  await page.emulateMedia({ colorScheme: "dark" });
  await render(page, {
    tokens: tokensCss({ system: { dark: PREFERS_DARK } }),
    root: { "data-theme": "light" },
  });
  expect(await read(page, ["root"])).toEqual(["light"]);
});

test("a marker value that is not a mode keeps the system preference", async ({ page }) => {
  const tokens = tokensCss({ system: { dark: PREFERS_DARK } });
  for (const colorScheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const value of ["system", "light dark", ""]) {
      await render(page, { tokens, root: { "data-theme": value } });
      expect(await read(page, ["root"]), `data-theme="${value}"`).toEqual([colorScheme]);
    }
  }
});

test("nested markers create islands in both directions", async ({ page }) => {
  const ids = ["root", "section", "plain", "island", "deep"];
  const tokens = tokensCss({ system: { dark: PREFERS_DARK } });

  await page.emulateMedia({ colorScheme: "light" });
  await render(page, { tokens, body: island("dark", "light") });
  expect(await read(page, ids)).toEqual(["light", "dark", "dark", "light", "light"]);

  await render(page, { tokens, root: { "data-theme": "dark" }, body: island("light", "dark") });
  expect(await read(page, ids)).toEqual(["dark", "light", "light", "dark", "dark"]);

  await page.emulateMedia({ colorScheme: "dark" });
  await render(page, { tokens, body: island("light", "dark") });
  expect(await read(page, ids)).toEqual(["dark", "light", "light", "dark", "dark"]);
});

test("every activation point redeclares every token", async ({ page }) => {
  // `accent` is equal in both modes; a marked descendant still resets an ancestor's override.
  await render(page, {
    tokens: tokensCss(),
    body:
      '<section id="section" data-theme="dark" style="--accent: override">' +
      '<p id="plain"></p><div id="island" data-theme="dark"></div></section>',
  });
  expect(await read(page, ["section", "plain", "island"], "--accent")).toEqual([
    "override",
    "override",
    "shared",
  ]);
});

test("custom conditions beat explicit markers and system conditions", async ({ page }) => {
  await render(page, {
    tokens: tokensCss({
      system: { dark: ALWAYS },
      selectors: { light: ".force-light", dark: ".force-dark" },
    }),
    root: { class: "force-light" },
    body:
      '<p id="marked-dark" data-theme="dark" class="force-light"></p>' +
      '<p id="marked-light" data-theme="light" class="force-dark"></p>',
  });
  expect(await read(page, ["root", "marked-dark", "marked-light"])).toEqual([
    "light",
    "light",
    "dark",
  ]);
});

test("overlapping custom conditions resolve by authored mode order", async ({ page }) => {
  const options = { attribute: false, selectors: { light: ".light", dark: ".dark" } } as const;
  const body = '<p id="both" class="light dark"></p>';

  await render(page, { tokens: tokensCss(options), body });
  expect(await read(page, ["both"])).toEqual(["dark"]);

  await render(page, { tokens: tokensCss(options, ["dark", "light"]), body });
  expect(await read(page, ["both"])).toEqual(["light"]);
});

test("a two-axis palette and scheme resolves through ordered custom conditions", async ({
  page,
}) => {
  // The shape of the theme-coordinate example: modes authored from general to specific.
  const modes = ["mono-light", "mono-dark", "vivid-light", "vivid-dark"] as const;
  const graph = api.defineTokenGraph({
    modes,
    defaultMode: "mono-light",
    tokens: {
      surface: {
        "mono-light": "mono-light",
        "mono-dark": "mono-dark",
        "vivid-light": "vivid-light",
        "vivid-dark": "vivid-dark",
      },
    },
  });
  const tokens = api.orThrow(
    api.exportCssVars(api.orThrow(api.compileTokenGraph(graph)), {
      attribute: false,
      system: { "mono-dark": PREFERS_DARK },
      selectors: {
        "mono-light": '[data-scheme="light"]',
        "mono-dark": '[data-scheme="dark"]',
        "vivid-light": '[data-palette="vivid"]',
        "vivid-dark": [
          { selector: '[data-palette="vivid"]:not([data-scheme="light"])', media: PREFERS_DARK },
          { selector: '[data-palette="vivid"][data-scheme="dark"]' },
        ],
      },
    }),
  ).css;

  const cases = [
    ["light", {}, "mono-light"],
    ["dark", {}, "mono-dark"],
    ["dark", { "data-scheme": "light" }, "mono-light"],
    ["light", { "data-scheme": "dark" }, "mono-dark"],
    ["light", { "data-palette": "vivid" }, "vivid-light"],
    ["dark", { "data-palette": "vivid" }, "vivid-dark"],
    ["dark", { "data-palette": "vivid", "data-scheme": "light" }, "vivid-light"],
    ["light", { "data-palette": "vivid", "data-scheme": "dark" }, "vivid-dark"],
  ] as const;
  for (const [colorScheme, root, expected] of cases) {
    await page.emulateMedia({ colorScheme });
    await render(page, { tokens, root });
    expect(await read(page, ["root"]), `${colorScheme} ${JSON.stringify(root)}`).toEqual([
      expected,
    ]);
  }
});

test("application rules with specificity win whether placed before or after the tokens", async ({
  page,
}) => {
  const application = ".app { --surface: app; } :root { --surface: app-root; }";
  const body = '<p id="target" data-theme="dark" class="app"></p>';
  for (const placement of ["before", "after"] as const) {
    await render(page, { tokens: tokensCss(), [placement]: application, body });
    expect(await read(page, ["target", "root"]), placement).toEqual(["app", "app-root"]);
  }
});

test("zero-specificity application rules compete by source order", async ({ page }) => {
  const application = ":where(.app) { --surface: app; }";
  const body = '<p id="target" data-theme="dark" class="app"></p>';

  await render(page, { before: application, tokens: tokensCss(), body });
  expect(await read(page, ["target"])).toEqual(["dark"]);
  await render(page, { tokens: tokensCss(), after: application, body });
  expect(await read(page, ["target"])).toEqual(["app"]);
});

test("shadcn stock fallback layers permit generated variables and restore after removal", async ({
  page,
}) => {
  const graph = api.defineTokenGraph({
    modes: ["light", "dark"],
    defaultMode: "light",
    tokens: { background: { light: "rgb(240, 240, 240)", dark: "rgb(20, 20, 20)" } },
  });
  const scheme = api.orThrow(api.compileTokenGraph(graph));
  const stock = ":root { --background: white; } .dark { --background: black; }";
  const selectors = { light: ".light", dark: ".dark" } as const;
  const tokens = api.orThrow(api.exportCssVars(scheme, { attribute: false, selectors })).css;
  const body = '<section id="dark" class="dark"><div id="light" class="light"></div></section>';
  const paint = "#dark, #light { background-color: var(--background); }";
  for (const placement of ["before", "after"] as const) {
    await render(page, { tokens, [placement]: stock, body });
    expect(await read(page, ["root", "dark"], "--background")).toEqual(["white", "black"]);
    for (const generated of [
      tokens,
      api.orThrow(
        api.exportCssVars(scheme, { attribute: false, selectors, cascadeLayer: "tokens" }),
      ).css,
    ]) {
      await render(page, {
        tokens: generated,
        before: `@layer base, tokens; ${placement === "before" ? `@layer base { ${stock} }` : ""}`,
        ...(placement === "after" ? { after: `@layer base { ${stock} }` } : {}),
        body: `${body}<style>${paint}</style>`,
      });
      expect(await read(page, ["root", "dark", "light"], "--background")).toEqual([
        "rgb(240, 240, 240)",
        "rgb(20, 20, 20)",
        "rgb(240, 240, 240)",
      ]);
      expect(
        await page
          .locator("#dark")
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      ).toBe("rgb(20, 20, 20)");
      expect(
        await page
          .locator("#light")
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      ).toBe("rgb(240, 240, 240)");
      await page.evaluate(() => {
        const generatedStyle = [...document.head.querySelectorAll("style")].find((style) =>
          style.textContent?.includes(":where(:root)"),
        );
        if (generatedStyle === undefined) {
          throw new Error("Generated stylesheet is missing");
        }
        generatedStyle.remove();
      });
      expect(await read(page, ["root", "dark", "light"], "--background")).toEqual([
        "white",
        "black",
        "black",
      ]);
    }
  }
});

test("cascadeLayer follows cascade-layer order", async ({ page }) => {
  const tokens = tokensCss({ cascadeLayer: "tokens" });
  expect(tokens.startsWith("@layer tokens {\n")).toBe(true);
  const body = '<p id="target" data-theme="dark" class="app"></p>';
  const cases: readonly (Omit<Scenario, "tokens" | "body"> & {
    readonly name: string;
    readonly expected: string;
  })[] = [
    {
      name: "an unlayered zero-specificity rule placed before wins",
      before: ":where(.app) { --surface: app; }",
      expected: "app",
    },
    {
      name: "an earlier layer loses despite specificity",
      before: "@layer app, tokens; @layer app { html #target.app { --surface: app; } }",
      expected: "dark",
    },
    {
      name: "a later layer wins",
      before: "@layer tokens, app; @layer app { :where(.app) { --surface: app; } }",
      expected: "app",
    },
    {
      name: "the same layer compares specificity",
      before: "@layer tokens { .app { --surface: app; } }",
      expected: "app",
    },
    {
      name: "the same layer then compares order (before)",
      before: "@layer tokens { :where(.app) { --surface: app; } }",
      expected: "dark",
    },
    {
      name: "the same layer then compares order (after)",
      after: "@layer tokens { :where(.app) { --surface: app; } }",
      expected: "app",
    },
    {
      name: "an important declaration in an earlier layer wins",
      before: "@layer app, tokens; @layer app { .app { --surface: app !important; } }",
      expected: "app",
    },
  ];
  for (const { name, expected, ...placement } of cases) {
    await render(page, { ...placement, tokens, body });
    expect(await read(page, ["target"]), name).toEqual([expected]);
  }
});

test("wrapped :host selectors match shadow hosts, and markers nest inside shadow trees", async ({
  page,
}) => {
  const tokens = tokensCss({ root: ":host" });
  expect(tokens).toContain(":where(:host) {\n");
  expect(tokens).toContain(':where(:host([data-theme="dark"]), [data-theme="dark"]) {\n');
  const systemTokens = tokensCss({ root: ":host", system: { dark: ALWAYS } });

  await render(page, {
    tokens: "",
    body:
      '<div id="plain-host"></div><div id="dark-host" data-theme="dark"></div>' +
      '<div id="system-host"></div><div id="system-light-host" data-theme="light"></div>',
  });
  const computed = await page.evaluate(
    ({ tokens, systemTokens }) => {
      const byId = (root: Document | ShadowRoot, id: string): Element => {
        const element = root.getElementById(id);
        if (element === null) {
          throw new Error(`missing #${id}`);
        }
        return element;
      };
      const surface = (element: Element) =>
        getComputedStyle(element).getPropertyValue("--surface").trim();
      const result: Record<string, string> = {};
      for (const [hostId, css] of [
        ["plain-host", tokens],
        ["dark-host", tokens],
        ["system-host", systemTokens],
        ["system-light-host", systemTokens],
      ] as const) {
        const host = byId(document, hostId);
        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML =
          `<style>${css}</style><p id="inner"></p>` +
          '<section id="dark" data-theme="dark"><div id="light" data-theme="light">' +
          '<p id="light-child"></p></div></section>';
        result[hostId] = surface(host);
        for (const id of ["inner", "dark", "light", "light-child"]) {
          result[`${hostId} ${id}`] = surface(byId(shadow, id));
        }
      }
      return result;
    },
    { tokens, systemTokens },
  );

  expect(computed).toEqual({
    "plain-host": "light",
    "plain-host inner": "light",
    "plain-host dark": "dark",
    "plain-host light": "light",
    "plain-host light-child": "light",
    "dark-host": "dark",
    "dark-host inner": "dark",
    "dark-host dark": "dark",
    "dark-host light": "light",
    "dark-host light-child": "light",
    "system-host": "dark",
    "system-host inner": "dark",
    "system-host dark": "dark",
    "system-host light": "light",
    "system-host light-child": "light",
    "system-light-host": "light",
    "system-light-host inner": "light",
    "system-light-host dark": "dark",
    "system-light-host light": "light",
    "system-light-host light-child": "light",
  });
});

test("color-scheme follows its token only where application CSS binds it", async ({ page }) => {
  const tokens = tokensCss({ selectors: { dark: ".dark" } });
  const body =
    '<section id="section" data-theme="dark"><p id="child"></p></section>' +
    '<div id="custom" class="dark"><p id="custom-child"></p></div>';
  const ids = ["root", "section", "child", "custom", "custom-child"];

  // The token is dark on the section, but `color-scheme` inherits as a computed value.
  await render(page, { tokens, after: ":root { color-scheme: var(--color-scheme); }", body });
  expect(await read(page, ["section"], "--color-scheme")).toEqual(["dark"]);
  expect(await read(page, ids, "color-scheme")).toEqual([
    "light",
    "light",
    "light",
    "light",
    "light",
  ]);

  await render(page, {
    tokens,
    after: ":root, [data-theme] { color-scheme: var(--color-scheme); }",
    body,
  });
  expect(await read(page, ids, "color-scheme")).toEqual([
    "light",
    "dark",
    "dark",
    "light",
    "light",
  ]);

  await render(page, { tokens, after: ":where(*) { color-scheme: var(--color-scheme); }", body });
  expect(await read(page, ids, "color-scheme")).toEqual(["light", "dark", "dark", "dark", "dark"]);
});

// D8: aliases sort before their targets; the concat links its public part and inlines its
// internal part under ordinary public selection. Every standalone target is declaration-safe.
function referenceCss(options: SchemeTokens.ExportCssVarsOptions<string, Mode> = {}): string {
  const graph = api.defineTokenGraph({
    modes: ["light", "dark"],
    defaultMode: "light",
    tokens: {
      "a.alias": api.tokenRef("b.alias"),
      "b.alias": api.tokenRef("z.spacing"),
      "z.spacing": { light: "10px", dark: "20px" },
      private: { value: { light: "3px", dark: "5px" }, visibility: "internal" },
      width: api.tokenConcat`calc(${api.tokenRef("b.alias")} + ${api.tokenRef("private")})`,
    },
  });
  return api.orThrow(
    api.exportCssVars(api.orThrow(api.compileTokenGraph(graph)), {
      ...options,
      references: "var",
    }),
  ).css;
}

test("reference chains and mixed concat follow nested light/dark/light activation", async ({
  page,
}) => {
  const tokens = referenceCss();
  expect(tokens.indexOf("--a-alias:")).toBeLessThan(tokens.indexOf("--b-alias:"));
  expect(tokens.indexOf("--b-alias:")).toBeLessThan(tokens.indexOf("--z-spacing:"));
  const body = island("dark", "light");
  const ids = ["root", "section", "plain", "island", "deep"];
  await render(page, {
    tokens,
    body,
    after:
      "#section, #plain, #island, #deep { width: var(--a-alias); padding-left: var(--width); }",
  });
  for (const property of ["--a-alias", "--b-alias"]) {
    expect(await read(page, ids, property)).toEqual(["10px", "20px", "20px", "10px", "10px"]);
  }
  expect(await read(page, ids.slice(1), "width")).toEqual(["20px", "20px", "10px", "10px"]);
  expect(await read(page, ids.slice(1), "padding-left")).toEqual(["25px", "25px", "13px", "13px"]);
});

test("unlayered target overrides propagate locally through chains and concat, regardless of stylesheet order", async ({
  page,
}) => {
  const tokens = referenceCss({ cascadeLayer: "tokens" });
  const body =
    '<section id="active" class="app probe" data-theme="dark"><p id="child" class="probe"></p></section>';
  const application =
    ":where(.app) { --z-spacing: 30px; --private: 1000px; } .probe { width: var(--a-alias); padding-left: var(--width); }";
  for (const placement of ["before", "after"] as const) {
    await render(page, { tokens, body, [placement]: application });
    expect(await read(page, ["active", "child"], "--z-spacing"), placement).toEqual([
      "30px",
      "30px",
    ]);
    expect(await read(page, ["active", "child"], "width"), placement).toEqual(["30px", "30px"]);
    // The linked part follows the override, while the omitted private part stays at dark's 5px.
    expect(await read(page, ["active", "child"], "padding-left"), placement).toEqual([
      "35px",
      "35px",
    ]);
    expect(await read(page, ["active", "child"], "--private"), placement).toEqual([
      "1000px",
      "1000px",
    ]);
  }
});

test("an unmarked descendant target override leaves inherited aliases and concat computed at their declaration element", async ({
  page,
}) => {
  await render(page, {
    tokens: referenceCss(),
    body: '<section data-theme="dark"><div id="local" style="--z-spacing: 40px"><p id="child"></p></div></section>',
    after: "#local, #child { width: var(--a-alias); padding-left: var(--width); }",
  });
  expect(await read(page, ["local", "child"], "--z-spacing")).toEqual(["40px", "40px"]);
  expect(await read(page, ["local", "child"], "width")).toEqual(["20px", "20px"]);
  expect(await read(page, ["local", "child"], "padding-left")).toEqual(["25px", "25px"]);
});

test("var references compute at a shadow host and at nested shadow activation elements", async ({
  page,
}) => {
  const tokens = referenceCss({ root: ":host", cascadeLayer: "tokens" });
  await render(page, { tokens: "", body: '<div id="host" data-theme="dark"></div>' });
  const computed = await page.evaluate((css) => {
    const host = document.getElementById("host");
    if (host === null) {
      throw new Error("missing #host");
    }
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML =
      '<p id="inner"></p><section id="light" data-theme="light"><div id="dark" data-theme="dark"></div></section>';
    const style = document.createElement("style");
    style.textContent =
      css +
      ":host, p, section, div { width: var(--a-alias); padding-left: var(--width); } #light { --z-spacing: 15px; }";
    shadow.prepend(style);
    return [
      host,
      ...["inner", "light", "dark"].map((id) => {
        const element = shadow.getElementById(id);
        if (element === null) {
          throw new Error(`missing #${id}`);
        }
        return element;
      }),
    ].map((element) => {
      const style = getComputedStyle(element);
      return [style.getPropertyValue("--a-alias").trim(), style.width, style.paddingLeft];
    });
  }, tokens);
  expect(computed).toEqual([
    ["20px", "20px", "25px"],
    ["20px", "20px", "25px"],
    ["15px", "15px", "18px"],
    ["20px", "20px", "25px"],
  ]);
});

test("var concat substitutes CSS tokens rather than assembling dimensions or quoted strings", async ({
  page,
}) => {
  const scheme = api.orThrow(
    api.compileTokenGraph(
      api.defineTokenGraph({
        tokens: {
          number: "20",
          dimension: api.tokenConcat`${api.tokenRef("number")}px`,
          quoted: api.tokenConcat`"${api.tokenRef("number")}"`,
        },
      }),
    ),
  );
  const body = '<p id="probe"></p>';
  const application =
    "#probe { padding-left: var(--dimension); } #probe::before { content: var(--quoted); }";
  const content = () =>
    page.locator("#probe").evaluate((element) => getComputedStyle(element, "::before").content);
  await render(page, {
    tokens: api.orThrow(api.exportCssVars(scheme)).css,
    body,
    after: application,
  });
  expect(await read(page, ["probe"], "padding-left")).toEqual(["20px"]);
  expect(await content()).toBe('"20"');
  await render(page, {
    tokens: api.orThrow(api.exportCssVars(scheme, { references: "var" })).css,
    body,
    after: application,
  });
  expect(await read(page, ["probe"], "padding-left")).toEqual(["0px"]);
  expect(await content()).toBe('"var(--number)"');
});
