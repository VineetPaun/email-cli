import { TemplateRole } from "../types.js";
import { normalizeRole } from "../config/project.js";

type LinkKey = "portfolio" | "github" | "linkedin" | "resume";

type StackLayer = {
  title: string;
  description: string;
  tag: string;
};

type Highlight = {
  value: string;
  label: string;
};

export type PlatformTemplateData = {
  badge: string;
  intro: string;
  stack: [StackLayer, StackLayer, StackLayer];
  highlights: [Highlight, Highlight, Highlight];
  followup: string;
  ctaLabel: string;
  ctaLinkKey: LinkKey;
};

export const ROLE_PLATFORM_TEMPLATE_DATA: Record<TemplateRole, PlatformTemplateData> = {
  fe: {
    badge: "Frontend Engineering",
    intro:
      "I build fast, polished product interfaces with React, Next.js, and TypeScript, with strong attention to performance and accessibility.",
    stack: [
      {
        title: "Interface Layer",
        description: "Scalable component architecture and reusable design systems for product teams.",
        tag: "UI"
      },
      {
        title: "Experience Layer",
        description: "Performance optimization, responsive behavior, and smooth interaction design.",
        tag: "UX"
      },
      {
        title: "Quality Layer",
        description: "Accessibility-first implementation with measurable standards and QA guardrails.",
        tag: "A11Y"
      }
    ],
    highlights: [
      { value: "35%", label: "Faster Load Time" },
      { value: "90+", label: "Lighthouse Score" },
      { value: "2x", label: "UI Delivery Speed" }
    ],
    followup: "If useful, I can share relevant frontend work and implementation details.",
    ctaLabel: "View Portfolio",
    ctaLinkKey: "portfolio"
  },
  be: {
    badge: "Backend Engineering",
    intro:
      "I work on APIs, scalable services, data modeling, and production reliability with a focus on maintainability.",
    stack: [
      {
        title: "API Layer",
        description: "Service contracts and endpoint design that remain clear as products and teams scale.",
        tag: "API"
      },
      {
        title: "Data Layer",
        description: "Robust schema design, query tuning, and pipeline decisions that support growth.",
        tag: "Data"
      },
      {
        title: "Reliability Layer",
        description: "Observability-first operations with resilient deployments and predictable recovery.",
        tag: "SRE"
      }
    ],
    highlights: [
      { value: "99.95%", label: "Service Uptime" },
      { value: "-40%", label: "p95 Latency" },
      { value: "0", label: "Critical Incidents (Q)" }
    ],
    followup: "If useful, I can share backend systems I have built and the tradeoffs behind key design choices.",
    ctaLabel: "View GitHub",
    ctaLinkKey: "github"
  },
  fullstack: {
    badge: "Full Stack Developer",
    intro:
      "I ship end-to-end features across frontend and backend with a strong focus on product quality and system reliability.",
    stack: [
      {
        title: "Product Layer",
        description: "Clean UI implementation, flow design, and practical frontend architecture.",
        tag: "UI"
      },
      {
        title: "Service Layer",
        description: "API integration, business logic, and backend services that support product velocity.",
        tag: "App"
      },
      {
        title: "Delivery Layer",
        description: "Deployment readiness, observability, and ownership from build to production.",
        tag: "Ops"
      }
    ],
    highlights: [
      { value: "E2E", label: "Feature Ownership" },
      { value: "2x", label: "Release Velocity" },
      { value: "99.9%", label: "Reliability Target" }
    ],
    followup: "If useful, I can share projects where I owned complete feature delivery across the stack.",
    ctaLabel: "View Project Work",
    ctaLinkKey: "portfolio"
  }
};

export function getPlatformTemplateData(roleInput?: string): PlatformTemplateData {
  const role = normalizeRole(roleInput);
  return ROLE_PLATFORM_TEMPLATE_DATA[role];
}
