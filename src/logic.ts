import type {
  AnnotationInput,
  AnnotationLogItem,
  AnnotationResult,
  AnnotationRuleSet,
  OverrideNote,
  RuleStep,
  StepSelections,
} from "./types";

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export function deriveAnnotationResult(
  ruleSet: AnnotationRuleSet,
  selections: StepSelections,
): AnnotationResult {
  const log: AnnotationLogItem[] = ruleSet.steps.map((step) => {
    const selectedIds = selections[step.id] ?? [];
    const selectedOptions = step.options.filter((option) =>
      selectedIds.includes(option.id),
    );

    return {
      stepId: step.id,
      stepTitle: step.title,
      selectedLabels: selectedOptions.map((option) => option.label),
      tags: selectedOptions.map((option) => option.tag).filter(Boolean) as string[],
    };
  });

  const rawTags = unique(log.flatMap((item) => item.tags));
  const finalTagSet = new Set(rawTags);
  const overrides: OverrideNote[] = [];

  ruleSet.overrideGroups.forEach((group) => {
    const hasSpecific = group.specificTags.some((tag) => finalTagSet.has(tag));
    if (!hasSpecific) {
      return;
    }

    const removed = group.generalTags.filter((tag) => finalTagSet.has(tag));
    if (removed.length === 0) {
      return;
    }

    removed.forEach((tag) => finalTagSet.delete(tag));
    overrides.push({
      groupId: group.id,
      title: group.title,
      removed,
      kept: group.specificTags.filter((tag) => finalTagSet.has(tag)),
    });
  });

  return {
    rawTags,
    finalTags: Array.from(finalTagSet),
    log,
    overrides,
  };
}

export function setSelection(
  selections: StepSelections,
  step: RuleStep,
  optionId: string,
  checked: boolean,
): StepSelections {
  const current = selections[step.id] ?? [];
  const option = step.options.find((item) => item.id === optionId);
  const isNone = option != null && !option.tag;

  if (isNone && checked) {
    return { ...selections, [step.id]: [optionId] };
  }

  const withoutNone = current.filter((id) => {
    const selectedOption = step.options.find((item) => item.id === id);
    return selectedOption?.tag;
  });

  if (step.kind === "decision") {
    return { ...selections, [step.id]: checked ? [optionId] : [] };
  }

  const next = checked
    ? unique([...withoutNone, optionId])
    : withoutNone.filter((id) => id !== optionId);

  return { ...selections, [step.id]: next };
}

export function buildMermaid(ruleSet: AnnotationRuleSet): string {
  const lines = [
    "flowchart TD",
    "  classDef tagNote fill:#e7f5f1,stroke:#86bfb0,color:#174b45;",
    "  classDef generalTag fill:#fff2d7,stroke:#d5aa50,color:#5f4710;",
  ];

  ruleSet.steps.forEach((step, index) => {
    const stepId = mermaidId(step.id);
    const shape =
      step.kind === "process"
        ? `[\"${escapeMermaid(step.title)}\\n${escapeMermaid(step.prompt)}\"]`
        : `{\"${escapeMermaid(step.title)}\\n${escapeMermaid(step.prompt)}\"}`;

    lines.push(`  ${stepId}${shape}`);

    if (index > 0) {
      lines.push(`  ${mermaidId(ruleSet.steps[index - 1].id)} --> ${stepId}`);
    }

    step.options.forEach((option) => {
      if (!option.tag) {
        return;
      }

      const tagNodeId = mermaidId(`${step.id}_${option.id}_tag`);
      lines.push(`  ${tagNodeId}["${escapeMermaid(option.tag)}"]`);
      lines.push(
        `  ${stepId} -. "${escapeMermaid(option.label)}で付与" .- ${tagNodeId}`,
      );
      lines.push(`  class ${tagNodeId} ${option.isGeneral ? "generalTag" : "tagNote"};`);
    });
  });

  return lines.join("\n");
}

export function buildRuleJson(ruleSet: AnnotationRuleSet): string {
  return JSON.stringify(ruleSet, null, 2);
}

export function buildResultCsv(
  input: AnnotationInput,
  result: AnnotationResult,
): string {
  const headers = [
    "message_id",
    "previous_message",
    "target_message",
    "tags",
    "raw_tags",
    "overrides",
    "notes",
  ];

  const row = [
    input.messageId,
    input.previousMessage,
    input.targetMessage,
    result.finalTags.join("|"),
    result.rawTags.join("|"),
    result.overrides
      .map((item) => `${item.title}: ${item.removed.join("|")} -> ${item.kept.join("|")}`)
      .join("; "),
    input.notes,
  ];

  return [headers, row].map((items) => items.map(csvCell).join(",")).join("\n");
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function mermaidId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

function escapeMermaid(value: string): string {
  return value.replaceAll('"', '\\"');
}
