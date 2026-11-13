import type { MetadataRoute } from "next";

// Концепт для конкурса: поисковикам здесь делать нечего. Дублирует мета-тег noindex в layout.tsx.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
