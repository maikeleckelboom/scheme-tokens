import { defineConfig } from "vitepress";

export default defineConfig({
  title: "scheme-tokens",
  description: "Compile string-valued token graphs and export CSS custom properties.",
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
        content: "Compile string-valued token graphs and export CSS custom properties.",
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
          { text: "Add Material 3 Roles", link: "/guide/material3" },
          {
            text: "Application Theme Coordinates",
            link: "/guide/application-theme-coordinates",
          },
          { text: "Tailwind CSS v4", link: "/guide/tailwind-css-v4" },
          { text: "TypeScript Access", link: "/guide/typescript-access" },
          { text: "Upgrade to 0.4", link: "/guide/migration" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API", link: "/reference/api" },
          { text: "CSS", link: "/reference/css" },
          { text: "Material 3", link: "/reference/material3" },
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
