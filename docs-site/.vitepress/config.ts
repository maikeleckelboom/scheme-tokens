import { defaultHoverInfoProcessor, transformerTwoslash } from "@shikijs/vitepress-twoslash";
import { createFileSystemTypesCache } from "@shikijs/vitepress-twoslash/cache-fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";

const configDirectory = dirname(fileURLToPath(import.meta.url));
const twoslashCacheDirectory = join(configDirectory, "cache", "twoslash");

export default defineConfig({
  title: "scheme-tokens",
  description: "Compile authored token graphs and export deterministic CSS variables.",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: false,
  markdown: {
    codeTransformers: [
      transformerTwoslash({
        explicitTrigger: true,
        processHoverInfo: formatTwoslashHoverInfo,
        throws: true,
        typesCache: createFileSystemTypesCache({
          dir: twoslashCacheDirectory,
        }),
      }),
    ],
  },
  head: [
    [
      "meta",
      {
        name: "theme-color",
        content: "#101820",
      },
    ],
    [
      "meta",
      {
        property: "og:type",
        content: "website",
      },
    ],
    [
      "meta",
      {
        property: "og:title",
        content: "scheme-tokens",
      },
    ],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Stable token graph contracts, scheme compilation, and deterministic CSS variable export.",
      },
    ],
  ],
  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/guide/getting-started" },
      { text: "API", link: "/reference/api" },
      { text: "Diagnostics", link: "/reference/diagnostics" },
    ],
    sidebar: [
      {
        text: "Start",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting Started", link: "/guide/getting-started" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Define Tokens", link: "/guide/define-tokens" },
          { text: "Export CSS Variables", link: "/guide/export-css-variables" },
          { text: "TypeScript Access", link: "/guide/typescript-access" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API", link: "/reference/api" },
          { text: "Diagnostics", link: "/reference/diagnostics" },
        ],
      },
    ],
    search: {
      provider: "local",
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/maikeleckelboom/scheme-tokens",
      },
    ],
    footer: {
      message: "Released under the MIT license.",
      copyright: "Copyright Maikel Eckelboom",
    },
  },
});

function formatTwoslashHoverInfo(info: string): string {
  let content = defaultHoverInfoProcessor(info);
  const overload = content.match(/\s+\(\+(\d+) overloads?\)$/u);
  if (overload?.index !== undefined) {
    content = content.slice(0, overload.index).trim();
  }

  const callable = normalizedCallableInfo(content);
  const formatted =
    callable === undefined ? formatTypeInfo(content) : formatFunctionSignature(callable);

  if (overload === null) {
    return formatted;
  }

  const count = overload[1] ?? "1";
  return `${formatted}\n\n// +${count} overload${count === "1" ? "" : "s"}`;
}

function formatTypeInfo(content: string): string {
  if (content.length <= 96 || !content.includes(": ")) {
    return content;
  }
  return content.replace(/: /u, ":\n  ");
}

function normalizedCallableInfo(content: string): string | undefined {
  if (content.startsWith("function ")) {
    return content;
  }
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?(?:<|\()/u.test(content) && content.includes("):")) {
    return `function ${content}`;
  }
  return undefined;
}

function formatFunctionSignature(content: string): string {
  const match = /^function\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)/u.exec(content);
  if (match === null || match.index !== 0) {
    return content;
  }

  const name = match[1] ?? "";
  let cursor = match[0].length;
  const generic = content[cursor] === "<" ? readBalanced(content, cursor, "<", ">") : undefined;
  if (generic !== undefined) {
    cursor = generic.end + 1;
  }

  if (content[cursor] !== "(") {
    return content;
  }
  const parameters = readBalanced(content, cursor, "(", ")");
  if (parameters === undefined) {
    return content;
  }
  cursor = parameters.end + 1;

  if (!content.slice(cursor).startsWith(":")) {
    return content;
  }

  const signatureName =
    generic === undefined
      ? `function ${name}`
      : `function ${name}<\n${splitTopLevel(generic.body)
          .map((part) => `  ${part}`)
          .join(",\n")}\n>`;
  const parameterLines = splitTopLevel(parameters.body).map(
    (parameter) => `  ${parameter.replace(/ \| undefined$/u, "")},`,
  );

  return [`${signatureName}(`, ...parameterLines, `): ${content.slice(cursor + 1).trim()}`].join(
    "\n",
  );
}

function readBalanced(
  input: string,
  start: number,
  open: string,
  close: string,
): { body: string; end: number } | undefined {
  let depth = 0;
  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return { body: input.slice(start + 1, index), end: index };
      }
    }
  }
  return undefined;
}

function splitTopLevel(input: string): readonly string[] {
  const parts: string[] = [];
  let start = 0;
  let angleDepth = 0;
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "<") {
      angleDepth += 1;
    } else if (char === ">") {
      angleDepth = Math.max(0, angleDepth - 1);
    } else if (char === "(") {
      parenDepth += 1;
    } else if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
    } else if (char === "{") {
      braceDepth += 1;
    } else if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (char === "[") {
      bracketDepth += 1;
    } else if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (
      char === "," &&
      angleDepth === 0 &&
      parenDepth === 0 &&
      braceDepth === 0 &&
      bracketDepth === 0
    ) {
      parts.push(input.slice(start, index).trim());
      start = index + 1;
    }
  }

  const last = input.slice(start).trim();
  return last === "" ? parts : [...parts, last];
}
