import { defineConfig } from "vitepress";

export default defineConfig({
  title: "scheme-tokens",
  description: "Compile authored token graphs and export deterministic CSS variables.",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: false,
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
      { text: "Migration", link: "/guide/migration" },
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
          {
            text: "Application Theme Coordinates",
            link: "/guide/application-theme-coordinates",
          },
          { text: "Export CSS Variables", link: "/guide/export-css-variables" },
          { text: "Tailwind CSS v4", link: "/guide/tailwind-css-v4" },
          { text: "TypeScript Access", link: "/guide/typescript-access" },
          { text: "Migration to 0.1", link: "/guide/migration" },
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
