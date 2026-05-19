import type { AnnotationRuleSet } from "./types";

export const initialRuleSet: AnnotationRuleSet = {
  id: "blank-template",
  title: "新しいタグセット",
  version: "0.1.0",
  summary: "タグセットとアノテーションルールをメニューから作成してください。",
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
