import { initialRuleSet } from "./rules";
import type { AnnotationRuleSet, RuleSetLibrary } from "./types";

const STORAGE_KEY = "annotation-flowchart:rule-set-library:v1";

export function loadRuleSetLibrary(): RuleSetLibrary {
  if (typeof window === "undefined") {
    return createDefaultLibrary();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultLibrary();
  }

  try {
    return normalizeLibrary(JSON.parse(raw));
  } catch {
    return createDefaultLibrary();
  }
}

export function saveRuleSetLibrary(library: RuleSetLibrary) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
}

export function createDefaultLibrary(): RuleSetLibrary {
  const ruleSet = normalizeRuleSet(initialRuleSet, "blank-template");
  const now = new Date().toISOString();

  return {
    version: 1,
    activeId: ruleSet.id,
    savedAt: now,
    ruleSets: [{ ...ruleSet, createdAt: ruleSet.createdAt ?? now }],
  };
}

export function normalizeLibrary(value: unknown): RuleSetLibrary {
  const fallback = createDefaultLibrary();
  if (!isRecord(value) || !Array.isArray(value.ruleSets)) {
    return fallback;
  }

  const usedIds: string[] = [];
  const ruleSets = value.ruleSets
    .filter(isRecord)
    .map((item, index) => {
      const normalized = normalizeRuleSet(item, `rule-set-${index + 1}`);
      const id = makeUniqueId(normalized.id, usedIds);
      usedIds.push(id);
      return { ...normalized, id };
    });

  if (ruleSets.length === 0) {
    return fallback;
  }

  const activeId =
    typeof value.activeId === "string" &&
    ruleSets.some((ruleSet) => ruleSet.id === value.activeId)
      ? value.activeId
      : ruleSets[0].id;

  return {
    version: 1,
    activeId,
    savedAt:
      typeof value.savedAt === "string"
        ? value.savedAt
        : new Date().toISOString(),
    ruleSets,
  };
}

export function normalizeRuleSet(
  value: unknown,
  fallbackId = "imported-rule-set",
): AnnotationRuleSet {
  const now = new Date().toISOString();
  if (!isRecord(value)) {
    return { ...createBlankRuleSet(), id: sanitizeId(fallbackId) };
  }

  const title = stringValue(value.title, "新しいタグセット");
  const id = sanitizeId(stringValue(value.id, fallbackId || title));

  return {
    id,
    title,
    version: stringValue(value.version, "0.1.0"),
    summary: stringValue(value.summary, ""),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
    steps: Array.isArray(value.steps) ? value.steps : [],
    tags: Array.isArray(value.tags) ? value.tags : [],
    overrideGroups: Array.isArray(value.overrideGroups)
      ? value.overrideGroups
      : [],
  } as AnnotationRuleSet;
}

export function createBlankRuleSet(existingIds: string[] = []): AnnotationRuleSet {
  const now = new Date().toISOString();
  const id = makeUniqueId("new-rule-set", existingIds);

  return {
    id,
    title: "新しいタグセット",
    version: "0.1.0",
    summary: "このタグセットの目的や対象データを書いてください。",
    createdAt: now,
    updatedAt: now,
    tags: [],
    overrideGroups: [],
    steps: [
      {
        id: "start",
        section: "準備",
        title: "対象を読む",
        badge: "Start",
        kind: "process",
        prompt: "アノテーション対象を読み、必要な文脈を確認する",
        guidance: "",
        examples: [],
        options: [],
      },
    ],
  };
}

export function duplicateRuleSet(
  ruleSet: AnnotationRuleSet,
  existingIds: string[],
): AnnotationRuleSet {
  const now = new Date().toISOString();
  const next = structuredClone(ruleSet);
  const id = makeUniqueId(`${ruleSet.id}-copy`, existingIds);

  return {
    ...next,
    id,
    title: `${ruleSet.title} コピー`,
    createdAt: now,
    updatedAt: now,
  };
}

export function stampRuleSet(ruleSet: AnnotationRuleSet): AnnotationRuleSet {
  return {
    ...ruleSet,
    updatedAt: new Date().toISOString(),
  };
}

export function makeUniqueId(preferredId: string, usedIds: string[]): string {
  const base = sanitizeId(preferredId);
  if (!usedIds.includes(base)) {
    return base;
  }

  let index = 2;
  while (usedIds.includes(`${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

export function formatSavedAt(value?: string): string {
  if (!value) {
    return "未保存";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未保存";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sanitizeId(value: string): string {
  const sanitized = value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "rule-set";
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
