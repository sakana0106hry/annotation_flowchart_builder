import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileJson,
  FileText,
  GitBranch,
  ImageDown,
  Info,
  Layers3,
  ListChecks,
  Menu,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Split,
  Tag,
  Tags,
  Trash2,
  Upload,
  Wand2,
  Workflow,
  X,
} from "lucide-react";
import {
  buildMermaid,
  buildResultCsv,
  buildRuleJson,
  deriveAnnotationResult,
  downloadText,
  setSelection,
} from "./logic";
import {
  createBlankRuleSet,
  createDefaultLibrary,
  duplicateRuleSet,
  formatSavedAt,
  loadRuleSetLibrary,
  makeUniqueId as makeUniqueRuleSetId,
  normalizeLibrary,
  normalizeRuleSet,
  saveRuleSetLibrary,
  stampRuleSet,
} from "./storage";
import type {
  AnnotationInput,
  AnnotationRuleSet,
  OverrideGroup,
  RuleSetLibrary,
  RuleOption,
  RuleStep,
  StepSelections,
  TagDefinition,
  TagFamily,
} from "./types";

type CenterView = "flow" | "mermaid" | "json";
type MenuView = "sets" | "overview" | "tags" | "overrides" | "io";
type StepTemplate = "process" | "decision" | "multi";

const tagFamilies: TagFamily[] = ["社会", "FB", "タスク", "感情"];

export default function App() {
  const [library, setLibrary] = useState<RuleSetLibrary>(() => loadRuleSetLibrary());
  const ruleSet = useMemo(() => getActiveRuleSet(library), [library]);
  const [selectedStepId, setSelectedStepId] = useState("");
  const [selections, setSelections] = useState<StepSelections>({});
  const [centerView, setCenterView] = useState<CenterView>("flow");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>("sets");
  const [annotationInput, setAnnotationInput] = useState<AnnotationInput>({
    messageId: "001",
    previousMessage: "",
    targetMessage: "",
    notes: "",
  });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    saveRuleSetLibrary(library);
  }, [library]);

  useEffect(() => {
    if (!ruleSet.steps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(ruleSet.steps[0]?.id ?? "");
    }
  }, [ruleSet, selectedStepId]);

  const setRuleSet: Dispatch<SetStateAction<AnnotationRuleSet>> = (action) => {
    setLibrary((current) => {
      const active = getActiveRuleSet(current);
      const nextRuleSet = stampRuleSet(
        typeof action === "function"
          ? (action as (current: AnnotationRuleSet) => AnnotationRuleSet)(active)
          : action,
      );

      return stampLibrary({
        ...current,
        ruleSets: current.ruleSets.map((item) =>
          item.id === active.id ? nextRuleSet : item,
        ),
      });
    });
  };

  const result = useMemo(
    () => deriveAnnotationResult(ruleSet, selections),
    [ruleSet, selections],
  );

  const selectedStep =
    ruleSet.steps.find((step) => step.id === selectedStepId) ?? ruleSet.steps[0];

  const updateRuleMeta = (patch: Partial<AnnotationRuleSet>) => {
    setRuleSet((current) => ({ ...current, ...patch }));
  };

  const selectRuleSet = (ruleSetId: string) => {
    const target = library.ruleSets.find((item) => item.id === ruleSetId);
    if (!target) {
      return;
    }

    setLibrary((current) => stampLibrary({ ...current, activeId: ruleSetId }));
    setSelections({});
  };

  const createRuleSet = () => {
    const nextRuleSet = createBlankRuleSet(library.ruleSets.map((item) => item.id));

    setLibrary((current) =>
      stampLibrary({
        ...current,
        activeId: nextRuleSet.id,
        ruleSets: [...current.ruleSets, nextRuleSet],
      }),
    );
    setSelections({});
    setMenuView("overview");
  };

  const duplicateActiveRuleSet = () => {
    const nextRuleSet = duplicateRuleSet(
      ruleSet,
      library.ruleSets.map((item) => item.id),
    );

    setLibrary((current) =>
      stampLibrary({
        ...current,
        activeId: nextRuleSet.id,
        ruleSets: [...current.ruleSets, nextRuleSet],
      }),
    );
    setSelections({});
    setMenuView("overview");
  };

  const deleteRuleSet = (ruleSetId: string) => {
    if (library.ruleSets.length <= 1) {
      window.alert("タグセットは最低1つ必要です。");
      return;
    }

    const nextRuleSets = library.ruleSets.filter((item) => item.id !== ruleSetId);
    const nextActiveId =
      library.activeId === ruleSetId ? nextRuleSets[0].id : library.activeId;

    setLibrary((current) =>
      stampLibrary({
        ...current,
        activeId: nextActiveId,
        ruleSets: current.ruleSets.filter((item) => item.id !== ruleSetId),
      }),
    );

    if (library.activeId === ruleSetId) {
      setSelections({});
    }
  };

  const renameRuleSetId = (ruleSetId: string, nextId: string): boolean => {
    const normalizedId = nextId.trim();
    if (!normalizedId || normalizedId === ruleSetId) {
      return normalizedId === ruleSetId;
    }

    if (!isValidRuleSetId(normalizedId)) {
      window.alert("タグセットIDは半角英数字、ハイフン、アンダースコアで入力してください。");
      return false;
    }

    if (library.ruleSets.some((item) => item.id === normalizedId)) {
      window.alert("同じタグセットIDがすでにあります。");
      return false;
    }

    setLibrary((current) =>
      stampLibrary({
        ...current,
        activeId: current.activeId === ruleSetId ? normalizedId : current.activeId,
        ruleSets: current.ruleSets.map((item) =>
          item.id === ruleSetId ? { ...item, id: normalizedId } : item,
        ),
      }),
    );

    return true;
  };

  const addTag = (draft?: Partial<TagDefinition>) => {
    setRuleSet((current) => {
      const id = makeUniqueId(
        draft?.id?.trim() || "T_NewTag",
        current.tags.map((tag) => tag.id),
      );
      return {
        ...current,
        tags: [
          ...current.tags,
          {
            id,
            family: draft?.family ?? "タスク",
            label: draft?.label?.trim() || "新しいタグ",
            description: draft?.description ?? "",
          },
        ],
      };
    });
  };

  const updateTag = (tagId: string, patch: Partial<TagDefinition>) => {
    setRuleSet((current) => ({
      ...current,
      tags: current.tags.map((tag) =>
        tag.id === tagId ? { ...tag, ...patch } : tag,
      ),
    }));
  };

  const renameTag = (tagId: string, nextId: string) => {
    const normalizedId = nextId.trim();
    if (!normalizedId || normalizedId === tagId) {
      return;
    }

    setRuleSet((current) => {
      if (current.tags.some((tag) => tag.id === normalizedId)) {
        window.alert("同じタグIDがすでにあります。");
        return current;
      }

      return {
        ...current,
        tags: current.tags.map((tag) =>
          tag.id === tagId ? { ...tag, id: normalizedId } : tag,
        ),
        steps: current.steps.map((step) => ({
          ...step,
          options: step.options.map((option) =>
            option.tag === tagId ? { ...option, tag: normalizedId } : option,
          ),
        })),
        overrideGroups: current.overrideGroups.map((group) => ({
          ...group,
          generalTags: group.generalTags.map((tag) =>
            tag === tagId ? normalizedId : tag,
          ),
          specificTags: group.specificTags.map((tag) =>
            tag === tagId ? normalizedId : tag,
          ),
        })),
      };
    });
  };

  const removeTag = (tagId: string) => {
    setRuleSet((current) => ({
      ...current,
      tags: current.tags.filter((tag) => tag.id !== tagId),
      steps: current.steps.map((step) => ({
        ...step,
        options: step.options.map((option) =>
          option.tag === tagId ? { ...option, tag: undefined } : option,
        ),
      })),
      overrideGroups: current.overrideGroups.map((group) => ({
        ...group,
        generalTags: group.generalTags.filter((tag) => tag !== tagId),
        specificTags: group.specificTags.filter((tag) => tag !== tagId),
      })),
    }));
  };

  const addOverrideGroup = () => {
    setRuleSet((current) => {
      const id = makeUniqueId(
        "override_group",
        current.overrideGroups.map((group) => group.id),
      );

      return {
        ...current,
        overrideGroups: [
          ...current.overrideGroups,
          {
            id,
            title: "新しいオーバーライドルール",
            generalTags: [],
            specificTags: [],
          },
        ],
      };
    });
  };

  const updateOverrideGroup = (
    groupId: string,
    patch: Partial<OverrideGroup>,
  ) => {
    setRuleSet((current) => ({
      ...current,
      overrideGroups: current.overrideGroups.map((group) =>
        group.id === groupId ? { ...group, ...patch } : group,
      ),
    }));
  };

  const removeOverrideGroup = (groupId: string) => {
    setRuleSet((current) => ({
      ...current,
      overrideGroups: current.overrideGroups.filter((group) => group.id !== groupId),
      steps: current.steps.map((step) => ({
        ...step,
        options: step.options.map((option) =>
          option.overrideGroupId === groupId
            ? { ...option, overrideGroupId: undefined }
            : option,
        ),
      })),
    }));
  };

  const toggleOverrideTag = (
    groupId: string,
    field: "generalTags" | "specificTags",
    tagId: string,
    checked: boolean,
  ) => {
    setRuleSet((current) => ({
      ...current,
      overrideGroups: current.overrideGroups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }

        const nextTags = checked
          ? Array.from(new Set([...group[field], tagId]))
          : group[field].filter((tag) => tag !== tagId);

        return { ...group, [field]: nextTags };
      }),
    }));
  };

  const updateStep = (stepId: string, patch: Partial<RuleStep>) => {
    setRuleSet((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step,
      ),
    }));
  };

  const updateOption = (
    stepId: string,
    optionId: string,
    patch: Partial<RuleOption>,
  ) => {
    setRuleSet((current) => ({
      ...current,
      steps: current.steps.map((step) => {
        if (step.id !== stepId) {
          return step;
        }

        return {
          ...step,
          options: step.options.map((option) =>
            option.id === optionId ? { ...option, ...patch } : option,
          ),
        };
      }),
    }));
  };

  const addOption = (stepId: string) => {
    setRuleSet((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              options: [
                ...step.options,
                {
                  id: makeId("option"),
                  label: "新しい分岐",
                  description: "次へ",
                },
              ],
            }
          : step,
      ),
    }));
  };

  const removeOption = (stepId: string, optionId: string) => {
    setRuleSet((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              options: step.options.filter((option) => option.id !== optionId),
            }
          : step,
      ),
    }));
    setSelections((current) => {
      const next = { ...current };
      next[stepId] = (next[stepId] ?? []).filter((id) => id !== optionId);
      return next;
    });
  };

  const addStep = (template: StepTemplate = "decision") => {
    const newStep = createStepFromTemplate(template);

    setRuleSet((current) => ({
      ...current,
      steps: [...current.steps, newStep],
    }));
    setSelectedStepId(newStep.id);
  };

  const removeStep = (stepId: string) => {
    setRuleSet((current) => {
      if (current.steps.length <= 1) {
        return current;
      }

      const nextSteps = current.steps.filter((step) => step.id !== stepId);
      if (selectedStepId === stepId) {
        setSelectedStepId(nextSteps[0]?.id ?? "");
      }
      return { ...current, steps: nextSteps };
    });
    setSelections((current) => {
      const next = { ...current };
      delete next[stepId];
      return next;
    });
  };

  const resetAll = () => {
    if (!window.confirm("保存済みのタグセットをすべて初期状態に戻しますか？")) {
      return;
    }

    const nextLibrary = createDefaultLibrary();
    const nextRuleSet = getActiveRuleSet(nextLibrary);
    setLibrary(nextLibrary);
    setSelectedStepId(nextRuleSet.steps[0]?.id ?? "");
    setSelections({});
    setCenterView("flow");
    setMenuView("sets");
  };

  const importRules = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      if (isRuleSetLibraryPayload(parsed)) {
        const nextLibrary = stampLibrary(normalizeLibrary(parsed));
        const nextRuleSet = getActiveRuleSet(nextLibrary);
        setLibrary(nextLibrary);
        setSelectedStepId(nextRuleSet.steps[0]?.id ?? "");
        setSelections({});
        setMenuView("sets");
        return;
      }

      if (!isRuleSetPayload(parsed)) {
        throw new Error("Invalid rule set");
      }

      const importedRuleSet = normalizeRuleSet(parsed, "imported-rule-set");
      const existingIds = library.ruleSets.map((item) => item.id);
      const importedId = makeUniqueRuleSetId(importedRuleSet.id, existingIds);
      const nextRuleSet = {
        ...importedRuleSet,
        id: importedId,
        title:
          importedId === importedRuleSet.id
            ? importedRuleSet.title
            : `${importedRuleSet.title} 読込`,
      };

      setLibrary((current) =>
        stampLibrary({
          ...current,
          activeId: nextRuleSet.id,
          ruleSets: [...current.ruleSets, nextRuleSet],
        }),
      );
      setSelectedStepId(nextRuleSet.steps[0]?.id ?? "");
      setSelections({});
      setMenuView("overview");
    } catch {
      window.alert("JSONを読み込めませんでした。");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const exportSvg = () => {
    const svg = getSvgText(svgRef.current);
    if (!svg) {
      return;
    }
    downloadText("annotation-flowchart.svg", svg, "image/svg+xml;charset=utf-8");
  };

  const exportPng = () => {
    const svg = svgRef.current;
    const svgText = getSvgText(svg);
    if (!svg || !svgText) {
      return;
    }

    const { width, height } = svg.viewBox.baseVal;
    const image = new Image();
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.scale(2, 2);
      context.drawImage(image, 0, 0);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        if (!pngBlob) {
          return;
        }

        const pngUrl = URL.createObjectURL(pngBlob);
        const anchor = document.createElement("a");
        anchor.href = pngUrl;
        anchor.download = "annotation-flowchart.png";
        anchor.click();
        URL.revokeObjectURL(pngUrl);
      });
    };

    image.src = url;
  };

  const exportResultCsv = () => {
    downloadText(
      "annotation-result.csv",
      buildResultCsv(annotationInput, result),
      "text/csv;charset=utf-8",
    );
  };

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <Workflow size={24} aria-hidden="true" />
          <div>
            <h1>{ruleSet.title}</h1>
            <p>v{ruleSet.version}</p>
          </div>
        </div>

        <div className="topActions">
          <select
            className="ruleSetSwitcher"
            aria-label="タグセットを切り替え"
            value={library.activeId}
            onChange={(event) => selectRuleSet(event.target.value)}
          >
            {library.ruleSets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <button
            className="iconTextButton menuButton"
            type="button"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={18} />
            メニュー
          </button>
          <input
            ref={fileInputRef}
            className="hiddenInput"
            type="file"
            accept="application/json,.json"
            onChange={(event) => importRules(event.target.files?.[0])}
          />
        </div>
      </header>

      <RuleMenu
        activeView={menuView}
        isOpen={isMenuOpen}
        library={library}
        ruleSet={ruleSet}
        onAddOverrideGroup={addOverrideGroup}
        onAddTag={addTag}
        onClose={() => setIsMenuOpen(false)}
        onCreateRuleSet={createRuleSet}
        onDeleteRuleSet={deleteRuleSet}
        onDuplicateRuleSet={duplicateActiveRuleSet}
        onExportActiveJson={() =>
          downloadText(
            `${ruleSet.id}.json`,
            buildRuleJson(ruleSet),
            "application/json;charset=utf-8",
          )
        }
        onExportLibraryJson={() =>
          downloadText(
            "annotation-rule-set-library.json",
            JSON.stringify(library, null, 2),
            "application/json;charset=utf-8",
          )
        }
        onImportJson={() => fileInputRef.current?.click()}
        onRemoveOverrideGroup={removeOverrideGroup}
        onRemoveTag={removeTag}
        onRenameTag={renameTag}
        onRenameRuleSetId={renameRuleSetId}
        onResetAll={resetAll}
        onSelectRuleSet={selectRuleSet}
        onSetActiveView={setMenuView}
        onToggleOverrideTag={toggleOverrideTag}
        onUpdateMeta={updateRuleMeta}
        onUpdateOverrideGroup={updateOverrideGroup}
        onUpdateTag={updateTag}
      />

      <main className="workspace">
        <RuleEditor
          ruleSet={ruleSet}
          selectedStep={selectedStep}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          onUpdateMeta={updateRuleMeta}
          onUpdateStep={updateStep}
          onAddStep={addStep}
          onRemoveStep={removeStep}
          onAddOption={addOption}
          onUpdateOption={updateOption}
          onRemoveOption={removeOption}
        />

        <section className="centerStage" aria-label="フロー表示">
          <div className="stageToolbar">
            <div className="segmented" role="tablist" aria-label="表示切替">
              <button
                className={centerView === "flow" ? "active" : ""}
                type="button"
                onClick={() => setCenterView("flow")}
              >
                <GitBranch size={17} />
                フロー
              </button>
              <button
                className={centerView === "mermaid" ? "active" : ""}
                type="button"
                onClick={() => setCenterView("mermaid")}
              >
                <FileText size={17} />
                Mermaid
              </button>
              <button
                className={centerView === "json" ? "active" : ""}
                type="button"
                onClick={() => setCenterView("json")}
              >
                <FileJson size={17} />
                JSON
              </button>
            </div>

            <div className="exportButtons">
              <button className="iconTextButton secondary" type="button" onClick={exportSvg}>
                <Download size={17} />
                SVG
              </button>
              <button className="iconTextButton secondary" type="button" onClick={exportPng}>
                <ImageDown size={17} />
                PNG
              </button>
              <button
                className="iconTextButton secondary"
                type="button"
                onClick={() =>
                  downloadText(
                    "annotation-flowchart.mmd",
                    buildMermaid(ruleSet),
                    "text/plain;charset=utf-8",
                  )
                }
              >
                <FileText size={17} />
                MMD
              </button>
            </div>
          </div>

          {centerView === "flow" && <FlowCanvas ruleSet={ruleSet} svgRef={svgRef} />}
          {centerView === "mermaid" && (
            <pre className="codePane">{buildMermaid(ruleSet)}</pre>
          )}
          {centerView === "json" && <pre className="codePane">{buildRuleJson(ruleSet)}</pre>}
        </section>

        <RunnerPanel
          ruleSet={ruleSet}
          selections={selections}
          input={annotationInput}
          result={result}
          onInputChange={setAnnotationInput}
          onSelectionChange={setSelections}
          onExportCsv={exportResultCsv}
        />
      </main>
    </div>
  );
}

function RuleMenu({
  activeView,
  isOpen,
  library,
  ruleSet,
  onAddOverrideGroup,
  onAddTag,
  onClose,
  onCreateRuleSet,
  onDeleteRuleSet,
  onDuplicateRuleSet,
  onExportActiveJson,
  onExportLibraryJson,
  onImportJson,
  onRemoveOverrideGroup,
  onRemoveTag,
  onRenameTag,
  onRenameRuleSetId,
  onResetAll,
  onSelectRuleSet,
  onSetActiveView,
  onToggleOverrideTag,
  onUpdateMeta,
  onUpdateOverrideGroup,
  onUpdateTag,
}: {
  activeView: MenuView;
  isOpen: boolean;
  library: RuleSetLibrary;
  ruleSet: AnnotationRuleSet;
  onAddOverrideGroup: () => void;
  onAddTag: (draft?: Partial<TagDefinition>) => void;
  onClose: () => void;
  onCreateRuleSet: () => void;
  onDeleteRuleSet: (ruleSetId: string) => void;
  onDuplicateRuleSet: () => void;
  onExportActiveJson: () => void;
  onExportLibraryJson: () => void;
  onImportJson: () => void;
  onRemoveOverrideGroup: (groupId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onRenameTag: (tagId: string, nextId: string) => void;
  onRenameRuleSetId: (ruleSetId: string, nextId: string) => boolean;
  onResetAll: () => void;
  onSelectRuleSet: (ruleSetId: string) => void;
  onSetActiveView: (view: MenuView) => void;
  onToggleOverrideTag: (
    groupId: string,
    field: "generalTags" | "specificTags",
    tagId: string,
    checked: boolean,
  ) => void;
  onUpdateMeta: (patch: Partial<AnnotationRuleSet>) => void;
  onUpdateOverrideGroup: (
    groupId: string,
    patch: Partial<OverrideGroup>,
  ) => void;
  onUpdateTag: (tagId: string, patch: Partial<TagDefinition>) => void;
}) {
  const [tagDraft, setTagDraft] = useState<{
    id: string;
    label: string;
    family: TagFamily;
    description: string;
  }>({
    id: "",
    label: "",
    family: "タスク",
    description: "",
  });

  if (!isOpen) {
    return null;
  }

  const menuItems: Array<{
    id: MenuView;
    label: string;
    icon: typeof Info;
  }> = [
    { id: "sets", label: "タグセット", icon: Layers3 },
    { id: "overview", label: "基本情報", icon: Info },
    { id: "tags", label: "タグ管理", icon: Tags },
    { id: "overrides", label: "オーバーライド", icon: ShieldCheck },
    { id: "io", label: "入出力", icon: FileJson },
  ];

  return (
    <div className="menuBackdrop" onMouseDown={onClose}>
      <section
        className="menuDrawer"
        aria-label="ルールメニュー"
        aria-modal="true"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="menuHeader">
          <div>
            <h2>ルールメニュー</h2>
            <p>
              自動保存 {formatSavedAt(library.savedAt)} / {library.ruleSets.length} sets
            </p>
          </div>
          <button className="iconButton" type="button" title="閉じる" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="menuTabs" role="tablist" aria-label="メニュー切替">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeView === item.id ? "active" : ""}
                key={item.id}
                type="button"
                onClick={() => onSetActiveView(item.id)}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="menuContent">
          {activeView === "sets" && (
            <div className="menuSection">
              <div className="menuSectionHeader">
                <h3>タグセット</h3>
                <div className="inlineActions">
                  <button
                    className="iconTextButton compact"
                    type="button"
                    onClick={onCreateRuleSet}
                  >
                    <Plus size={16} />
                    新規
                  </button>
                  <button
                    className="iconTextButton compact"
                    type="button"
                    onClick={onDuplicateRuleSet}
                  >
                    <Layers3 size={16} />
                    複製
                  </button>
                </div>
              </div>

              <div className="builderGuide">
                <button type="button" onClick={() => onSetActiveView("overview")}>
                  <Info size={18} />
                  <strong>1. 名前を書く</strong>
                  <span>タグセットの目的や対象データを残す</span>
                </button>
                <button type="button" onClick={() => onSetActiveView("tags")}>
                  <Tags size={18} />
                  <strong>2. タグを作る</strong>
                  <span>ID、表示名、説明を登録する</span>
                </button>
                <button type="button" onClick={() => onSetActiveView("io")}>
                  <FileJson size={18} />
                  <strong>3. 共有する</strong>
                  <span>JSONで読み書きする</span>
                </button>
              </div>

              <div className="saveNotice">
                <ShieldCheck size={17} />
                <span>
                  編集内容はこのブラウザに自動保存されます。Codexがコードを修正しても、ここで編集した説明やタグセットは通常そのまま残ります。
                </span>
              </div>

              <div className="ruleSetList">
                {library.ruleSets.map((item) => (
                  <article
                    className={`ruleSetCard ${item.id === library.activeId ? "active" : ""}`}
                    key={item.id}
                  >
                    <button
                      className="ruleSetSelect"
                      type="button"
                      onClick={() => onSelectRuleSet(item.id)}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.summary || "説明なし"}</span>
                      <code>{item.id}</code>
                    </button>
                    <div className="ruleSetMeta">
                      <span>v{item.version}</span>
                      <span>更新 {formatSavedAt(item.updatedAt)}</span>
                      <button
                        className="iconButton danger"
                        type="button"
                        title="タグセットを削除"
                        disabled={library.ruleSets.length <= 1}
                        onClick={() => onDeleteRuleSet(item.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeView === "overview" && (
            <div className="menuSection">
              <label className="fieldBlock">
                <span>タグセットID</span>
                <input
                  key={ruleSet.id}
                  defaultValue={ruleSet.id}
                  onBlur={(event) => {
                    const nextId = event.currentTarget.value.trim();
                    const renamed = onRenameRuleSetId(ruleSet.id, nextId);
                    if (!renamed) {
                      event.currentTarget.value = ruleSet.id;
                    }
                  }}
                />
              </label>
              <div className="fieldGrid two">
                <label>
                  <span>タイトル</span>
                  <input
                    value={ruleSet.title}
                    onChange={(event) => onUpdateMeta({ title: event.target.value })}
                  />
                </label>
                <label>
                  <span>版</span>
                  <input
                    value={ruleSet.version}
                    onChange={(event) => onUpdateMeta({ version: event.target.value })}
                  />
                </label>
              </div>
              <label className="fieldBlock">
                <span>概要</span>
                <textarea
                  rows={4}
                  value={ruleSet.summary}
                  onChange={(event) => onUpdateMeta({ summary: event.target.value })}
                />
              </label>
            </div>
          )}

          {activeView === "tags" && (
            <div className="menuSection">
              <div className="menuSectionHeader">
                <h3>タグ</h3>
                <button
                  className="iconTextButton compact"
                  type="button"
                  onClick={() => onAddTag()}
                >
                  <Plus size={16} />
                  空タグ
                </button>
              </div>

              <div className="quickCreatePanel">
                <div className="quickCreateTitle">
                  <Tag size={18} />
                  <div>
                    <h4>タグを追加</h4>
                    <p>IDと表示名だけでも追加できます。</p>
                  </div>
                </div>
                <div className="quickTagGrid">
                  <label>
                    <span>タグID</span>
                    <input
                      placeholder="例: T_Question"
                      value={tagDraft.id}
                      onChange={(event) =>
                        setTagDraft((current) => ({
                          ...current,
                          id: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>系統</span>
                    <select
                      value={tagDraft.family}
                      onChange={(event) =>
                        setTagDraft((current) => ({
                          ...current,
                          family: event.target.value as TagFamily,
                        }))
                      }
                    >
                      {tagFamilies.map((family) => (
                        <option key={family} value={family}>
                          {family}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>表示名</span>
                    <input
                      placeholder="例: 質問"
                      value={tagDraft.label}
                      onChange={(event) =>
                        setTagDraft((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="fieldBlock">
                  <span>説明</span>
                  <textarea
                    rows={2}
                    placeholder="判定基準や例を書いておくと、あとで迷いにくくなります。"
                    value={tagDraft.description}
                    onChange={(event) =>
                      setTagDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="fullButton compactFull"
                  type="button"
                  onClick={() => {
                    onAddTag(tagDraft);
                    setTagDraft({
                      id: "",
                      label: "",
                      family: tagDraft.family,
                      description: "",
                    });
                  }}
                >
                  <Plus size={17} />
                  タグを追加
                </button>
              </div>

              <div className="tagEditorList">
                {ruleSet.tags.map((tag) => (
                  <div className="tagEditorRow" key={tag.id}>
                    <div className="fieldGrid tagEditorGrid">
                      <label>
                        <span>タグID</span>
                        <input
                          defaultValue={tag.id}
                          onBlur={(event) => {
                            const nextId = event.currentTarget.value.trim();
                            const duplicated = ruleSet.tags.some(
                              (item) => item.id === nextId && item.id !== tag.id,
                            );

                            if (!nextId || duplicated) {
                              event.currentTarget.value = tag.id;
                              if (duplicated) {
                                window.alert("同じタグIDがすでにあります。");
                              }
                              return;
                            }

                            onRenameTag(tag.id, nextId);
                          }}
                        />
                      </label>
                      <label>
                        <span>系統</span>
                        <select
                          value={tag.family}
                          onChange={(event) =>
                            onUpdateTag(tag.id, {
                              family: event.target.value as TagFamily,
                            })
                          }
                        >
                          {tagFamilies.map((family) => (
                            <option key={family} value={family}>
                              {family}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>表示名</span>
                        <input
                          value={tag.label}
                          onChange={(event) =>
                            onUpdateTag(tag.id, { label: event.target.value })
                          }
                        />
                      </label>
                      <button
                        className="iconButton danger"
                        type="button"
                        title="タグを削除"
                        onClick={() => onRemoveTag(tag.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <label className="fieldBlock">
                      <span>説明</span>
                      <textarea
                        rows={2}
                        value={tag.description}
                        onChange={(event) =>
                          onUpdateTag(tag.id, { description: event.target.value })
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === "overrides" && (
            <div className="menuSection">
              <div className="menuSectionHeader">
                <h3>オーバーライドルール</h3>
                <button
                  className="iconTextButton compact"
                  type="button"
                  onClick={onAddOverrideGroup}
                >
                  <Plus size={16} />
                  追加
                </button>
              </div>

              <div className="overrideEditorList">
                {ruleSet.overrideGroups.map((group) => (
                  <div className="overrideEditorRow" key={group.id}>
                    <div className="overrideTitleLine">
                      <label>
                        <span>名前</span>
                        <input
                          value={group.title}
                          onChange={(event) =>
                            onUpdateOverrideGroup(group.id, {
                              title: event.target.value,
                            })
                          }
                        />
                      </label>
                      <button
                        className="iconButton danger"
                        type="button"
                        title="オーバーライドルールを削除"
                        onClick={() => onRemoveOverrideGroup(group.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="overrideColumns">
                      <TagPickList
                        checkedTags={group.generalTags}
                        label="一般タグ"
                        ruleSet={ruleSet}
                        onToggle={(tagId, checked) =>
                          onToggleOverrideTag(
                            group.id,
                            "generalTags",
                            tagId,
                            checked,
                          )
                        }
                      />
                      <TagPickList
                        checkedTags={group.specificTags}
                        label="特殊タグ"
                        ruleSet={ruleSet}
                        onToggle={(tagId, checked) =>
                          onToggleOverrideTag(
                            group.id,
                            "specificTags",
                            tagId,
                            checked,
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === "io" && (
            <div className="menuSection ioGrid">
              <button className="menuActionButton" type="button" onClick={onImportJson}>
                <Upload size={20} />
                <span>JSONを読み込む</span>
              </button>
              <button className="menuActionButton" type="button" onClick={onExportActiveJson}>
                <FileJson size={20} />
                <span>このタグセットを書き出す</span>
              </button>
              <button className="menuActionButton" type="button" onClick={onExportLibraryJson}>
                <Layers3 size={20} />
                <span>全タグセットを書き出す</span>
              </button>
              <button className="menuActionButton dangerAction" type="button" onClick={onResetAll}>
                <RotateCcw size={20} />
                <span>保存データを初期化</span>
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TagPickList({
  checkedTags,
  label,
  ruleSet,
  onToggle,
}: {
  checkedTags: string[];
  label: string;
  ruleSet: AnnotationRuleSet;
  onToggle: (tagId: string, checked: boolean) => void;
}) {
  return (
    <div className="tagPickList">
      <h4>{label}</h4>
      <div className="tagPickGrid">
        {ruleSet.tags.map((tag) => (
          <label className="tagPick" key={tag.id}>
            <input
              type="checkbox"
              checked={checkedTags.includes(tag.id)}
              onChange={(event) => onToggle(tag.id, event.target.checked)}
            />
            <span>{tag.id}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function RuleEditor({
  ruleSet,
  selectedStep,
  selectedStepId,
  onSelectStep,
  onUpdateMeta,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: {
  ruleSet: AnnotationRuleSet;
  selectedStep?: RuleStep;
  selectedStepId: string;
  onSelectStep: (id: string) => void;
  onUpdateMeta: (patch: Partial<AnnotationRuleSet>) => void;
  onUpdateStep: (stepId: string, patch: Partial<RuleStep>) => void;
  onAddStep: (template?: StepTemplate) => void;
  onRemoveStep: (stepId: string) => void;
  onAddOption: (stepId: string) => void;
  onUpdateOption: (
    stepId: string,
    optionId: string,
    patch: Partial<RuleOption>,
  ) => void;
  onRemoveOption: (stepId: string, optionId: string) => void;
}) {
  if (!selectedStep) {
    return null;
  }

  return (
    <aside className="panel editorPanel" aria-label="ルール編集">
      <div className="panelHeader">
        <Settings2 size={20} aria-hidden="true" />
        <h2>ルール編集</h2>
      </div>

      <div className="fieldGrid two">
        <label>
          <span>タイトル</span>
          <input
            value={ruleSet.title}
            onChange={(event) => onUpdateMeta({ title: event.target.value })}
          />
        </label>
        <label>
          <span>版</span>
          <input
            value={ruleSet.version}
            onChange={(event) => onUpdateMeta({ version: event.target.value })}
          />
        </label>
      </div>

      <label className="fieldBlock">
        <span>概要</span>
        <textarea
          rows={2}
          value={ruleSet.summary}
          onChange={(event) => onUpdateMeta({ summary: event.target.value })}
        />
      </label>

      <div className="stepTemplatePanel">
        <div className="quickCreateTitle">
          <Wand2 size={18} />
          <div>
            <h4>判定を追加</h4>
            <p>用途に近い形から始められます。</p>
          </div>
        </div>
        <div className="templateGrid">
          <button type="button" onClick={() => onAddStep("process")}>
            <Info size={17} />
            <strong>説明</strong>
            <span>読む・確認するなどの手順</span>
          </button>
          <button type="button" onClick={() => onAddStep("decision")}>
            <Split size={17} />
            <strong>はい/いいえ</strong>
            <span>1つの判定で分岐する</span>
          </button>
          <button type="button" onClick={() => onAddStep("multi")}>
            <ListChecks size={17} />
            <strong>複数選択</strong>
            <span>複数タグを同時に付ける</span>
          </button>
        </div>
      </div>

      <div className="stepList">
        {ruleSet.steps.map((step) => (
          <button
            className={`stepButton ${step.id === selectedStepId ? "active" : ""}`}
            key={step.id}
            type="button"
            onClick={() => onSelectStep(step.id)}
          >
            <span className="miniBadge">{step.badge}</span>
            <span>{step.title}</span>
          </button>
        ))}
      </div>

      <div className="editorBody">
        <div className="editorTitleLine">
          <h3>{selectedStep.title}</h3>
          <button
            className="iconButton danger"
            type="button"
            title="判定を削除"
            onClick={() => onRemoveStep(selectedStep.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div className="fieldGrid two">
          <label>
            <span>セクション</span>
            <input
              value={selectedStep.section}
              onChange={(event) =>
                onUpdateStep(selectedStep.id, { section: event.target.value })
              }
            />
          </label>
          <label>
            <span>バッジ</span>
            <input
              value={selectedStep.badge}
              onChange={(event) =>
                onUpdateStep(selectedStep.id, { badge: event.target.value })
              }
            />
          </label>
        </div>

        <div className="fieldGrid two">
          <label>
            <span>見出し</span>
            <input
              value={selectedStep.title}
              onChange={(event) =>
                onUpdateStep(selectedStep.id, { title: event.target.value })
              }
            />
          </label>
          <label>
            <span>型</span>
            <select
              value={selectedStep.kind}
              onChange={(event) =>
                onUpdateStep(selectedStep.id, {
                  kind: event.target.value as RuleStep["kind"],
                })
              }
            >
              <option value="process">処理</option>
              <option value="decision">二択</option>
              <option value="multi">複数選択</option>
            </select>
          </label>
        </div>

        <label className="fieldBlock">
          <span>判定文</span>
          <textarea
            rows={3}
            value={selectedStep.prompt}
            onChange={(event) =>
              onUpdateStep(selectedStep.id, { prompt: event.target.value })
            }
          />
        </label>

        <label className="fieldBlock">
          <span>補足</span>
          <textarea
            rows={2}
            value={selectedStep.guidance ?? ""}
            onChange={(event) =>
              onUpdateStep(selectedStep.id, { guidance: event.target.value })
            }
          />
        </label>

        <label className="fieldBlock">
          <span>例</span>
          <textarea
            rows={2}
            value={(selectedStep.examples ?? []).join("\n")}
            onChange={(event) =>
              onUpdateStep(selectedStep.id, {
                examples: event.target.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>

        <div className="optionHeader">
          <h4>分岐</h4>
          <button
            className="iconTextButton compact"
            type="button"
            onClick={() => onAddOption(selectedStep.id)}
          >
            <Plus size={16} />
            追加
          </button>
        </div>

        <datalist id="tag-options">
          {ruleSet.tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.label}
            </option>
          ))}
        </datalist>

        <div className="optionList">
          {selectedStep.options.map((option) => (
            <div className="optionRow" key={option.id}>
              <div className="fieldGrid two">
                <label>
                  <span>ラベル</span>
                  <input
                    value={option.label}
                    onChange={(event) =>
                      onUpdateOption(selectedStep.id, option.id, {
                        label: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span>タグ</span>
                  <input
                    list="tag-options"
                    value={option.tag ?? ""}
                    onChange={(event) =>
                      onUpdateOption(selectedStep.id, option.id, {
                        tag: event.target.value || undefined,
                      })
                    }
                  />
                </label>
              </div>
              <div className="fieldGrid optionMetaGrid">
                <label>
                  <span>説明</span>
                  <input
                    value={option.description ?? ""}
                    onChange={(event) =>
                      onUpdateOption(selectedStep.id, option.id, {
                        description: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span>オーバーライド</span>
                  <select
                    value={option.overrideGroupId ?? ""}
                    onChange={(event) =>
                      onUpdateOption(selectedStep.id, option.id, {
                        overrideGroupId: event.target.value || undefined,
                      })
                    }
                  >
                    <option value="">なし</option>
                    {ruleSet.overrideGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkboxLabel">
                  <input
                    type="checkbox"
                    checked={Boolean(option.isGeneral)}
                    onChange={(event) =>
                      onUpdateOption(selectedStep.id, option.id, {
                        isGeneral: event.target.checked,
                      })
                    }
                  />
                  一般
                </label>
                <button
                  className="iconButton danger"
                  type="button"
                  title="分岐を削除"
                  onClick={() => onRemoveOption(selectedStep.id, option.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="fullButton" type="button" onClick={() => onAddStep("decision")}>
        <Plus size={18} />
        判定を追加
      </button>
    </aside>
  );
}

function FlowCanvas({
  ruleSet,
  svgRef,
}: {
  ruleSet: AnnotationRuleSet;
  svgRef: RefObject<SVGSVGElement | null>;
}) {
  const layout = useMemo(() => buildLayout(ruleSet), [ruleSet]);

  return (
    <div className="flowViewport">
      <svg
        ref={svgRef}
        className="flowSvg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={ruleSet.title}
      >
        <defs>
          <marker
            id="arrow"
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="4"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#2f3a3d" />
          </marker>
          <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#0b1b1d" floodOpacity="0.12" />
          </filter>
        </defs>

        <rect width={layout.width} height={layout.height} fill="#f8faf8" />
        <text className="diagramTitle" x="42" y="36">
          {ruleSet.title}
        </text>
        <text className="diagramSubtitle" x="42" y="60">
          {ruleSet.summary}
        </text>

        {layout.nodes.map((node, index) => {
          const previous = layout.nodes[index - 1];
          if (!previous) {
            return null;
          }

          const x = previous.x + previous.width / 2;
          return (
            <path
              className="flowEdge"
              d={`M ${x} ${previous.y + previous.height} V ${node.y}`}
              key={`${previous.step.id}_${node.step.id}`}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {layout.nodes.map((node) => {
          const nodeBadgeWidth = badgeWidth(node.step.badge);
          const nodeBadgeX = node.x + 18;
          const nodeBadgeY = node.y + 18;
          const tagEdgeEndX = layout.tagX - 18;
          const edgeLabelX = node.x + node.width + 18;
          const edgeLabelWidth = getEdgeLabelWidth(node.x, node.width, layout.tagX);
          const tagRows = buildTagRows(
            node.step,
            getEdgeLabelMaxChars(edgeLabelWidth),
          );

          return (
            <g key={node.step.id}>
              <rect
                className={`nodeRect ${node.step.kind}`}
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx="8"
                filter="url(#nodeShadow)"
              />
              <rect
                className="nodeBadge"
                x={nodeBadgeX}
                y={nodeBadgeY}
                width={nodeBadgeWidth}
                height="26"
                rx="13"
              />
              <text
                className="nodeBadgeText"
                x={nodeBadgeX + nodeBadgeWidth / 2}
                y={nodeBadgeY + 13}
              >
                {node.step.badge}
              </text>
              <text className="nodeSection" x={node.x + 22 + nodeBadgeWidth} y={node.y + 36}>
                {node.step.section}
              </text>
              <text className="nodeTitle" x={node.x + 22} y={node.y + 70}>
                {node.step.title}
              </text>
              <WrappedSvgText
                className="nodePrompt"
                text={node.step.prompt}
                x={node.x + 22}
                y={node.y + 96}
                maxChars={30}
                lineHeight={18}
              />
              {node.step.guidance && (
                <WrappedSvgText
                  className="nodeGuidance"
                  text={node.step.guidance}
                  x={node.x + 22}
                  y={node.y + node.height - 22}
                  maxChars={34}
                  lineHeight={16}
                />
              )}

              {tagRows.map((row) => {
                const edgeY = node.y + row.edgeY;
                const tagY = edgeY - TAG_CHIP_HEIGHT / 2;
                const labelBoxY = edgeY - row.labelBoxHeight / 2;
                const labelTextY =
                  edgeY -
                  ((row.labelLines.length - 1) * EDGE_LABEL_LINE_HEIGHT) / 2;
                return (
                  <g key={row.option.id}>
                    <path
                      className="tagEdge"
                      d={`M ${node.x + node.width} ${edgeY} H ${tagEdgeEndX}`}
                      markerEnd="url(#arrow)"
                    />
                    <rect
                      className="edgeLabelBg"
                      x={edgeLabelX - EDGE_LABEL_PADDING_X}
                      y={labelBoxY}
                      width={edgeLabelWidth}
                      height={row.labelBoxHeight}
                      rx="8"
                    />
                    <text
                      className="edgeLabel"
                      x={edgeLabelX}
                      y={labelTextY}
                    >
                      {row.labelLines.map((line, index) => (
                        <tspan
                          x={edgeLabelX}
                          dy={index === 0 ? 0 : EDGE_LABEL_LINE_HEIGHT}
                          key={`${row.option.id}_${line}_${index}`}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>
                    <rect
                      className={row.option.isGeneral ? "tagChip general" : "tagChip"}
                      x={layout.tagX}
                      y={tagY}
                      width={layout.tagWidth}
                      height="32"
                      rx="8"
                    />
                    <text className="tagText" x={layout.tagX + 14} y={tagY + 21}>
                      {row.option.tag}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RunnerPanel({
  ruleSet,
  selections,
  input,
  result,
  onInputChange,
  onSelectionChange,
  onExportCsv,
}: {
  ruleSet: AnnotationRuleSet;
  selections: StepSelections;
  input: AnnotationInput;
  result: ReturnType<typeof deriveAnnotationResult>;
  onInputChange: (input: AnnotationInput) => void;
  onSelectionChange: (selections: StepSelections) => void;
  onExportCsv: () => void;
}) {
  return (
    <aside className="panel runnerPanel" aria-label="アノテーション実行">
      <div className="panelHeader">
        <ClipboardList size={20} aria-hidden="true" />
        <h2>実行</h2>
      </div>

      <div className="fieldGrid two">
        <label>
          <span>ID</span>
          <input
            value={input.messageId}
            onChange={(event) =>
              onInputChange({ ...input, messageId: event.target.value })
            }
          />
        </label>
        <button
          className="iconTextButton resultButton"
          type="button"
          onClick={onExportCsv}
        >
          <Download size={17} />
          CSV
        </button>
      </div>

      <label className="fieldBlock">
        <span>先行メッセージ</span>
        <textarea
          rows={3}
          value={input.previousMessage}
          onChange={(event) =>
            onInputChange({ ...input, previousMessage: event.target.value })
          }
        />
      </label>
      <label className="fieldBlock">
        <span>対象メッセージ</span>
        <textarea
          rows={4}
          value={input.targetMessage}
          onChange={(event) =>
            onInputChange({ ...input, targetMessage: event.target.value })
          }
        />
      </label>

      <div className="runnerSteps">
        {ruleSet.steps.map((step) => (
          <div className="runnerStep" key={step.id}>
            <div className="runnerStepHeader">
              <span className="miniBadge">{step.badge}</span>
              <strong>{step.title}</strong>
            </div>
            <p>{step.prompt}</p>
            {step.options.length > 0 && (
              <div className="choiceGrid">
                {step.options.map((option) => (
                  <label className="choice" key={option.id}>
                    <input
                      type={step.kind === "decision" ? "radio" : "checkbox"}
                      name={step.id}
                      checked={(selections[step.id] ?? []).includes(option.id)}
                      onChange={(event) =>
                        onSelectionChange(
                          setSelection(
                            selections,
                            step,
                            option.id,
                            event.target.checked,
                          ),
                        )
                      }
                    />
                    <span>{option.label}</span>
                    {option.tag && <code>{option.tag}</code>}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <label className="fieldBlock">
        <span>メモ</span>
        <textarea
          rows={2}
          value={input.notes}
          onChange={(event) => onInputChange({ ...input, notes: event.target.value })}
        />
      </label>

      <div className="resultBox">
        <div className="resultHeader">
          <CheckCircle2 size={19} />
          <h3>付与タグ</h3>
        </div>
        {result.finalTags.length === 0 ? (
          <p className="muted">未選択</p>
        ) : (
          <div className="tagList">
            {result.finalTags.map((tag) => (
              <span className="tagPill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {result.overrides.length > 0 && (
          <div className="overrideList">
            {result.overrides.map((override) => (
              <p key={override.groupId}>
                {override.title}: {override.removed.join(", ")} を除外
              </p>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function WrappedSvgText({
  text,
  x,
  y,
  maxChars,
  lineHeight,
  className,
}: {
  text: string;
  x: number;
  y: number;
  maxChars: number;
  lineHeight: number;
  className: string;
}) {
  const lines = wrapText(text, maxChars).slice(0, 4);

  return (
    <text className={className} x={x} y={y}>
      {lines.map((line, index) => (
        <tspan x={x} dy={index === 0 ? 0 : lineHeight} key={`${line}_${index}`}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

const TAG_TOP_OFFSET = 34;
const TAG_BOTTOM_PADDING = 34;
const TAG_ROW_GAP = 8;
const TAG_CHIP_HEIGHT = 32;
const EDGE_LABEL_LINE_HEIGHT = 13;
const EDGE_LABEL_PADDING_X = 8;
const EDGE_LABEL_PADDING_Y = 7;

interface TagRowLayout {
  option: RuleOption & { tag: string };
  edgeY: number;
  labelLines: string[];
  labelBoxHeight: number;
  rowHeight: number;
}

function buildTagRows(step: RuleStep, labelMaxChars: number): TagRowLayout[] {
  let offsetY = TAG_TOP_OFFSET;

  return step.options
    .filter((option): option is RuleOption & { tag: string } => Boolean(option.tag))
    .map((option) => {
      const labelLines = wrapText(option.label, labelMaxChars);
      const labelBoxHeight =
        labelLines.length * EDGE_LABEL_LINE_HEIGHT + EDGE_LABEL_PADDING_Y * 2;
      const rowHeight = Math.max(TAG_CHIP_HEIGHT, labelBoxHeight) + 8;
      const edgeY = offsetY + rowHeight / 2;

      offsetY += rowHeight + TAG_ROW_GAP;

      return {
        option,
        edgeY,
        labelLines,
        labelBoxHeight,
        rowHeight,
      };
    });
}

function tagRowsHeight(rows: TagRowLayout[]): number {
  if (rows.length === 0) {
    return 0;
  }

  const contentHeight = rows.reduce((sum, row) => sum + row.rowHeight, 0);
  return (
    TAG_TOP_OFFSET +
    contentHeight +
    TAG_ROW_GAP * (rows.length - 1) +
    TAG_BOTTOM_PADDING
  );
}

function getEdgeLabelWidth(nodeX: number, nodeWidth: number, tagX: number): number {
  const tagEdgeEndX = tagX - 18;
  const edgeLabelX = nodeX + nodeWidth + 18;
  return Math.max(120, tagEdgeEndX - edgeLabelX - EDGE_LABEL_PADDING_X - 6);
}

function getEdgeLabelMaxChars(labelWidth: number): number {
  return Math.max(8, Math.floor(labelWidth / 11));
}

function buildLayout(ruleSet: AnnotationRuleSet) {
  const x = 42;
  const width = 520;
  const tagX = 820;
  const tagWidth = 300;
  const edgeLabelMaxChars = getEdgeLabelMaxChars(
    getEdgeLabelWidth(x, width, tagX),
  );
  const nodes: Array<{
    step: RuleStep;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  let y = 88;

  ruleSet.steps.forEach((step) => {
    const promptLines = wrapText(step.prompt, 30).length;
    const rows = buildTagRows(step, edgeLabelMaxChars);
    const guidanceLines = step.guidance ? wrapText(step.guidance, 34).length : 0;
    const height = Math.max(
      132,
      96 + promptLines * 18 + guidanceLines * 16,
      tagRowsHeight(rows),
    );
    nodes.push({ step, x, y, width, height });
    y += height + 68;
  });

  return {
    nodes,
    width: 1200,
    height: y + 22,
    tagX,
    tagWidth,
  };
}

function getSvgText(svg: SVGSVGElement | null): string {
  if (!svg) {
    return "";
  }

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svg.viewBox.baseVal;

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("version", "1.1");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  inlineSvgStyles(svg, clone);

  return new XMLSerializer().serializeToString(clone);
}

const svgStyleProperties = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "opacity",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "paint-order",
  "filter",
];

function inlineSvgStyles(source: SVGElement, clone: SVGElement) {
  const sourceElements = Array.from(source.querySelectorAll("*"));
  const cloneElements = Array.from(clone.querySelectorAll("*"));

  sourceElements.forEach((sourceElement, index) => {
    const cloneElement = cloneElements[index];
    if (!cloneElement) {
      return;
    }

    const computed = window.getComputedStyle(sourceElement);
    const style = svgStyleProperties
      .map((property) => {
        const value = computed.getPropertyValue(property);
        return value ? `${property}:${value}` : "";
      })
      .filter(Boolean)
      .join(";");

    if (style) {
      cloneElement.setAttribute("style", style);
    }
  });
}

function wrapText(value: string, maxChars: number): string[] {
  const text = value.trim();
  if (!text) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  Array.from(text).forEach((char) => {
    current += char;
    if (current.length >= maxChars || /[。？?、,]/.test(char)) {
      lines.push(current);
      current = "";
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}

function badgeWidth(value: string): number {
  return Math.max(42, 18 + value.length * 12);
}

function createStepFromTemplate(template: StepTemplate): RuleStep {
  const base = {
    id: makeId("step"),
    section: "新規セクション",
    guidance: "",
    examples: [],
  };

  if (template === "process") {
    return {
      ...base,
      title: "新しい手順",
      badge: "Step",
      kind: "process",
      prompt: "確認する内容を入力",
      options: [],
    };
  }

  if (template === "multi") {
    return {
      ...base,
      title: "複数選択の判定",
      badge: "Multi",
      kind: "multi",
      prompt: "該当するものをすべて選ぶ判定文を入力",
      options: [
        { id: makeId("option"), label: "該当する", description: "タグを設定" },
        { id: makeId("option"), label: "別の該当項目", description: "タグを設定" },
        { id: makeId("none"), label: "なし", description: "次へ" },
      ],
    };
  }

  return {
    ...base,
    title: "はい/いいえ判定",
    badge: "Yes/No",
    kind: "decision",
    prompt: "判定質問を入力",
    options: [
      { id: makeId("yes"), label: "はい", description: "タグを設定" },
      { id: makeId("no"), label: "いいえ", description: "次へ" },
    ],
  };
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeUniqueId(prefix: string, usedIds: string[]): string {
  if (!usedIds.includes(prefix)) {
    return prefix;
  }

  let index = 2;
  while (usedIds.includes(`${prefix}_${index}`)) {
    index += 1;
  }

  return `${prefix}_${index}`;
}

function getActiveRuleSet(library: RuleSetLibrary): AnnotationRuleSet {
  return (
    library.ruleSets.find((ruleSet) => ruleSet.id === library.activeId) ??
    library.ruleSets[0]
  );
}

function stampLibrary(library: RuleSetLibrary): RuleSetLibrary {
  return {
    ...library,
    savedAt: new Date().toISOString(),
  };
}

function isRuleSetPayload(value: unknown): value is AnnotationRuleSet {
  return (
    value != null &&
    typeof value === "object" &&
    Array.isArray((value as AnnotationRuleSet).steps) &&
    Array.isArray((value as AnnotationRuleSet).tags)
  );
}

function isRuleSetLibraryPayload(value: unknown): value is RuleSetLibrary {
  return (
    value != null &&
    typeof value === "object" &&
    Array.isArray((value as RuleSetLibrary).ruleSets)
  );
}

function isValidRuleSetId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}
