export type StepKind = "process" | "decision" | "multi";

export type TagFamily = "社会" | "FB" | "タスク" | "感情";

export interface TagDefinition {
  id: string;
  family: TagFamily;
  label: string;
  description: string;
}

export interface RuleOption {
  id: string;
  label: string;
  tag?: string;
  description?: string;
  isGeneral?: boolean;
  overrideGroupId?: string;
}

export interface RuleStep {
  id: string;
  section: string;
  title: string;
  badge: string;
  kind: StepKind;
  prompt: string;
  guidance?: string;
  examples?: string[];
  options: RuleOption[];
}

export interface OverrideGroup {
  id: string;
  title: string;
  generalTags: string[];
  specificTags: string[];
}

export interface AnnotationRuleSet {
  id: string;
  title: string;
  version: string;
  summary: string;
  createdAt?: string;
  updatedAt?: string;
  steps: RuleStep[];
  tags: TagDefinition[];
  overrideGroups: OverrideGroup[];
}

export interface RuleSetLibrary {
  version: 1;
  activeId: string;
  savedAt: string;
  ruleSets: AnnotationRuleSet[];
}

export type StepSelections = Record<string, string[]>;

export interface AnnotationInput {
  messageId: string;
  previousMessage: string;
  targetMessage: string;
  notes: string;
}

export interface AnnotationLogItem {
  stepId: string;
  stepTitle: string;
  selectedLabels: string[];
  tags: string[];
}

export interface OverrideNote {
  groupId: string;
  title: string;
  removed: string[];
  kept: string[];
}

export interface AnnotationResult {
  rawTags: string[];
  finalTags: string[];
  log: AnnotationLogItem[];
  overrides: OverrideNote[];
}
