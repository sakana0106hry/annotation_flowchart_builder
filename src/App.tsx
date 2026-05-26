import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, DragEvent, RefObject, SetStateAction } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  FileJson,
  FileText,
  GitBranch,
  GripVertical,
  ImageDown,
  Info,
  Layers3,
  Link2,
  ListChecks,
  Menu,
  Pin,
  Plus,
  RotateCcw,
  Search,
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
type AppMode = "builder" | "dataset";
type MenuView = "sets" | "overview" | "tags" | "overrides" | "io";
type StepTemplate = "process" | "decision" | "multi";

const tagFamilies: TagFamily[] = ["社会", "FB", "タスク", "感情"];

interface CsvTable {
  headers: string[];
  records: Record<string, string>[];
}

interface ChatRow {
  rowId: string;
  sourceIndex: number;
  original: Record<string, string>;
  messageId: string;
  threadId: string;
  channelId: string;
  speaker: string;
  authorName: string;
  createdAt: string;
  content: string;
  isReply: boolean;
  replyToMessageId: string;
}

interface ChatAnnotation {
  selections: StepSelections;
  responseToId: string;
  note: string;
}

const emptyChatAnnotation: ChatAnnotation = {
  selections: {},
  responseToId: "",
  note: "",
};

export default function App() {
  const [library, setLibrary] = useState<RuleSetLibrary>(() => loadRuleSetLibrary());
  const ruleSet = useMemo(() => getActiveRuleSet(library), [library]);
  const [selectedStepId, setSelectedStepId] = useState("");
  const [selections, setSelections] = useState<StepSelections>({});
  const [centerView, setCenterView] = useState<CenterView>("flow");
  const [appMode, setAppMode] = useState<AppMode>("builder");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>("sets");
  const [annotationInput, setAnnotationInput] = useState<AnnotationInput>({
    messageId: "001",
    previousMessage: "",
    targetMessage: "",
    notes: "",
  });
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [chatRows, setChatRows] = useState<ChatRow[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [activeChatRowId, setActiveChatRowId] = useState("");
  const [contextSearch, setContextSearch] = useState("");
  const [responsePinIds, setResponsePinIds] = useState<string[]>([]);
  const [chatAnnotations, setChatAnnotations] = useState<
    Record<string, ChatAnnotation>
  >({});
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

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

  const reorderStep = (
    sourceStepId: string,
    targetStepId: string,
    placement: "before" | "after",
  ) => {
    if (sourceStepId === targetStepId) {
      return;
    }

    setRuleSet((current) => {
      const sourceStep = current.steps.find((step) => step.id === sourceStepId);
      const targetExists = current.steps.some((step) => step.id === targetStepId);

      if (!sourceStep || !targetExists) {
        return current;
      }

      const remainingSteps = current.steps.filter((step) => step.id !== sourceStepId);
      const targetIndex = remainingSteps.findIndex((step) => step.id === targetStepId);

      if (targetIndex === -1) {
        return current;
      }

      const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;

      return {
        ...current,
        steps: [
          ...remainingSteps.slice(0, insertIndex),
          sourceStep,
          ...remainingSteps.slice(insertIndex),
        ],
      };
    });

    setSelectedStepId(sourceStepId);
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

  const importChatCsv = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const parsed = parseCsv(await file.text());
      const rows = parsed.records.map(normalizeChatRow);

      setCsvHeaders(parsed.headers);
      setChatRows(rows);
      setCsvFileName(file.name);
      setActiveChatRowId(rows[0]?.rowId ?? "");
      setResponsePinIds([]);
      setChatAnnotations(() => {
        const next: Record<string, ChatAnnotation> = {};
        rows.forEach((row) => {
          next[row.rowId] = {
            ...emptyChatAnnotation,
            note: row.original.annotation_notes ?? "",
          };
        });
        return next;
      });
      setContextSearch("");
      setAppMode("dataset");
    } catch {
      window.alert("CSVを読み込めませんでした。");
    } finally {
      if (csvInputRef.current) {
        csvInputRef.current.value = "";
      }
    }
  };

  const updateChatAnnotation = (
    rowId: string,
    action: SetStateAction<ChatAnnotation>,
  ) => {
    setChatAnnotations((current) => {
      const base = current[rowId] ?? emptyChatAnnotation;
      const next =
        typeof action === "function"
          ? (action as (current: ChatAnnotation) => ChatAnnotation)(base)
          : action;

      return {
        ...current,
        [rowId]: next,
      };
    });
  };

  const exportAnnotatedChatCsv = () => {
    if (chatRows.length === 0) {
      return;
    }

    downloadText(
      withAnnotatedSuffix(csvFileName || "annotated-chat.csv"),
      `\uFEFF${buildAnnotatedChatCsv(csvHeaders, chatRows, chatAnnotations, ruleSet)}`,
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
          <div className="modeSwitch" aria-label="作業モード">
            <button
              className={appMode === "builder" ? "active" : ""}
              type="button"
              onClick={() => setAppMode("builder")}
            >
              <Workflow size={16} />
              フロー設計
            </button>
            <button
              className={appMode === "dataset" ? "active" : ""}
              type="button"
              onClick={() => setAppMode("dataset")}
            >
              <Database size={16} />
              CSV注釈
            </button>
          </div>
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
          <input
            ref={csvInputRef}
            className="hiddenInput"
            type="file"
            accept="text/csv,.csv"
            onChange={(event) => importChatCsv(event.target.files?.[0])}
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

      <main className={appMode === "dataset" ? "workspace datasetWorkspace" : "workspace"}>
        {appMode === "builder" ? (
          <>
            <RuleEditor
              ruleSet={ruleSet}
              selectedStep={selectedStep}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
              onUpdateMeta={updateRuleMeta}
              onUpdateStep={updateStep}
              onAddStep={addStep}
              onRemoveStep={removeStep}
              onReorderStep={reorderStep}
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
          </>
        ) : (
          <DatasetWorkspace
            annotations={chatAnnotations}
            contextSearch={contextSearch}
            csvFileName={csvFileName}
            responsePinIds={responsePinIds}
            rows={chatRows}
            activeRowId={activeChatRowId}
            ruleSet={ruleSet}
            onActiveRowChange={setActiveChatRowId}
            onAnnotationChange={updateChatAnnotation}
            onContextSearchChange={setContextSearch}
            onExportCsv={exportAnnotatedChatCsv}
            onImportCsv={() => csvInputRef.current?.click()}
            onResponsePinIdsChange={setResponsePinIds}
          />
        )}
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
  onReorderStep,
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
  onReorderStep: (
    sourceStepId: string,
    targetStepId: string,
    placement: "before" | "after",
  ) => void;
  onAddOption: (stepId: string) => void;
  onUpdateOption: (
    stepId: string,
    optionId: string,
    patch: Partial<RuleOption>,
  ) => void;
  onRemoveOption: (stepId: string, optionId: string) => void;
}) {
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    placement: "before" | "after";
  } | null>(null);

  const getDropPlacement = (event: DragEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    return y > rect.height / 2 ? "after" : "before";
  };

  const clearStepDrag = () => {
    setDraggedStepId(null);
    setDropTarget(null);
  };

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
        {ruleSet.steps.map((step, index) => {
          const targetClass =
            dropTarget?.id === step.id ? `drop-${dropTarget.placement}` : "";

          return (
            <div
              className={`stepListRow ${targetClass} ${
                draggedStepId === step.id ? "dragging" : ""
              }`}
              key={step.id}
              onDragOver={(event) => {
                if (!draggedStepId || draggedStepId === step.id) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget({
                  id: step.id,
                  placement: getDropPlacement(event),
                });
              }}
              onDragLeave={(event) => {
                const relatedTarget = event.relatedTarget;
                if (
                  relatedTarget instanceof Node &&
                  event.currentTarget.contains(relatedTarget)
                ) {
                  return;
                }

                setDropTarget((current) =>
                  current?.id === step.id ? null : current,
                );
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceStepId =
                  event.dataTransfer.getData("application/x-rule-step") ||
                  event.dataTransfer.getData("text/plain") ||
                  draggedStepId;

                if (sourceStepId && sourceStepId !== step.id) {
                  const placement =
                    dropTarget?.id === step.id
                      ? dropTarget.placement
                      : getDropPlacement(event);
                  onReorderStep(sourceStepId, step.id, placement);
                  onSelectStep(sourceStepId);
                }

                clearStepDrag();
              }}
            >
              <span
                aria-label={`${index + 1}番目の判定をドラッグして並び替え`}
                className="stepDragHandle"
                draggable
                role="button"
                tabIndex={0}
                title="ドラッグして並び替え"
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("application/x-rule-step", step.id);
                  event.dataTransfer.setData("text/plain", step.id);
                  setDraggedStepId(step.id);
                  setDropTarget(null);
                }}
                onDragEnd={clearStepDrag}
              >
                <GripVertical size={16} />
              </span>
              <button
                className={`stepButton ${step.id === selectedStepId ? "active" : ""}`}
                type="button"
                onClick={() => onSelectStep(step.id)}
              >
                <span className="miniBadge">{step.badge}</span>
                <span>{step.title}</span>
              </button>
            </div>
          );
        })}
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

function DatasetWorkspace({
  annotations,
  contextSearch,
  csvFileName,
  responsePinIds,
  rows,
  activeRowId,
  ruleSet,
  onActiveRowChange,
  onAnnotationChange,
  onContextSearchChange,
  onExportCsv,
  onImportCsv,
  onResponsePinIdsChange,
}: {
  annotations: Record<string, ChatAnnotation>;
  contextSearch: string;
  csvFileName: string;
  responsePinIds: string[];
  rows: ChatRow[];
  activeRowId: string;
  ruleSet: AnnotationRuleSet;
  onActiveRowChange: (rowId: string) => void;
  onAnnotationChange: (
    rowId: string,
    action: SetStateAction<ChatAnnotation>,
  ) => void;
  onContextSearchChange: (value: string) => void;
  onExportCsv: () => void;
  onImportCsv: () => void;
  onResponsePinIdsChange: Dispatch<SetStateAction<string[]>>;
}) {
  const [expandedRowId, setExpandedRowId] = useState("");
  const contextListRef = useRef<HTMLDivElement | null>(null);
  const activeContextCardRef = useRef<HTMLElement | null>(null);
  const activeContextScrollFrameRef = useRef<number | null>(null);
  const contextScrollFrameRef = useRef<number | null>(null);
  const isCenteringContextRef = useRef(false);
  const currentIndex = rows.findIndex((row) => row.rowId === activeRowId);
  const currentRow = currentIndex >= 0 ? rows[currentIndex] : rows[0];
  const annotation = currentRow
    ? annotations[currentRow.rowId] ?? emptyChatAnnotation
    : emptyChatAnnotation;

  const result = useMemo(
    () => deriveAnnotationResult(ruleSet, annotation.selections),
    [annotation.selections, ruleSet],
  );

  const threadRows = useMemo(() => {
    if (!currentRow) {
      return [];
    }

    const sameThread = rows.filter((row) => {
      if (!currentRow.threadId) {
        return row.channelId === currentRow.channelId;
      }

      return row.threadId === currentRow.threadId;
    });

    return sameThread.length > 0 ? sameThread : rows;
  }, [currentRow, rows]);

  const contextRows = threadRows.filter(
    (row) => row.rowId !== currentRow?.rowId,
  );

  const searchResults = useMemo(() => {
    const query = contextSearch.trim().toLowerCase();
    if (!query || !currentRow) {
      return [];
    }

    return rows
      .filter((row) => row.rowId !== currentRow.rowId)
      .filter((row) =>
        [row.content, row.speaker, row.authorName, row.threadId, row.messageId]
          .join("\n")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 12);
  }, [contextSearch, currentRow, rows]);

  const responsePinnedRows = responsePinIds
    .map((rowId) => rows.find((row) => row.rowId === rowId))
    .filter((row): row is ChatRow => Boolean(row));
  const responseRow = rows.find((row) => row.rowId === annotation.responseToId);
  const responseCandidateRows = uniqueRows([
    ...responsePinnedRows,
    ...contextRows,
    ...searchResults,
  ]).filter((row) => row.rowId !== currentRow?.rowId);
  const hasResponseLikeTag = result.finalTags.some(isResponseLikeTag);
  const hasResponseExpectedTag = result.finalTags.some(isResponseExpectedTag);
  const isCurrentPinned = currentRow
    ? responsePinIds.includes(currentRow.rowId)
    : false;
  const expandedRow = rows.find((row) => row.rowId === expandedRowId);
  const completedCount = rows.filter((row) => {
    const item = annotations[row.rowId] ?? emptyChatAnnotation;
    const itemResult = deriveAnnotationResult(ruleSet, item.selections);
    return itemResult.finalTags.length > 0 || item.note.trim();
  }).length;

  const keepActiveContextCardVisible = () => {
    const container = contextListRef.current;
    const referencedCard = activeContextCardRef.current;
    const currentCard =
      referencedCard &&
      container?.contains(referencedCard) &&
      referencedCard.dataset.currentContext === "true"
        ? referencedCard
        : container?.querySelector<HTMLElement>('[data-current-context="true"]');
    if (!container || !currentCard) {
      return;
    }

    if (contextScrollFrameRef.current != null) {
      window.cancelAnimationFrame(contextScrollFrameRef.current);
      contextScrollFrameRef.current = null;
    }

    if (activeContextScrollFrameRef.current != null) {
      window.cancelAnimationFrame(activeContextScrollFrameRef.current);
    }

    activeContextScrollFrameRef.current = window.requestAnimationFrame(() => {
      activeContextScrollFrameRef.current = null;
      const containerRect = container.getBoundingClientRect();
      const currentCardRect = currentCard.getBoundingClientRect();
      const headerRect = container
        .querySelector<HTMLElement>(".contextListHeader")
        ?.getBoundingClientRect();
      const visiblePadding = 10;
      const visibleTop =
        Math.max(containerRect.top, headerRect?.bottom ?? containerRect.top) +
        visiblePadding;
      const visibleBottom = containerRect.bottom - visiblePadding;
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      let scrollDelta = 0;

      if (currentCardRect.height > visibleHeight) {
        scrollDelta = currentCardRect.top - visibleTop;
      } else if (currentCardRect.top < visibleTop) {
        scrollDelta = currentCardRect.top - visibleTop;
      } else if (currentCardRect.bottom > visibleBottom) {
        scrollDelta = currentCardRect.bottom - visibleBottom;
      }

      if (scrollDelta === 0) {
        return;
      }

      isCenteringContextRef.current = true;
      container.scrollTo({
        top: Math.max(0, container.scrollTop + scrollDelta),
        behavior: "auto",
      });
      window.setTimeout(() => {
        isCenteringContextRef.current = false;
      }, 240);
    });
  };

  const syncActiveRowFromContextCenter = () => {
    const container = contextListRef.current;
    if (!container) {
      return;
    }

    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-context-row-id]"),
    );
    if (cards.length === 0) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    const nearest = cards.reduce<HTMLElement | null>((best, card) => {
      if (!best) {
        return card;
      }

      const cardRect = card.getBoundingClientRect();
      const bestRect = best.getBoundingClientRect();
      const cardDistance = Math.abs(cardRect.top + cardRect.height / 2 - centerY);
      const bestDistance = Math.abs(bestRect.top + bestRect.height / 2 - centerY);
      return cardDistance < bestDistance ? card : best;
    }, null);
    const nextRowId = nearest?.dataset.contextRowId;

    if (nextRowId && nextRowId !== currentRow?.rowId) {
      onActiveRowChange(nextRowId);
    }
  };

  const scheduleContextCenterSync = () => {
    if (isCenteringContextRef.current) {
      return;
    }

    if (contextScrollFrameRef.current != null) {
      window.cancelAnimationFrame(contextScrollFrameRef.current);
    }

    contextScrollFrameRef.current = window.requestAnimationFrame(() => {
      contextScrollFrameRef.current = null;
      syncActiveRowFromContextCenter();
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTyping || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (expandedRow) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveToIndex(currentIndex - 1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveToIndex(currentIndex + 1);
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const container = contextListRef.current;
        if (!container) {
          return;
        }

        event.preventDefault();
        container.scrollBy({
          top: event.key === "ArrowDown" ? 120 : -120,
          behavior: "auto",
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useLayoutEffect(() => {
    keepActiveContextCardVisible();
    const verifyTimer = window.setTimeout(keepActiveContextCardVisible, 80);
    return () => window.clearTimeout(verifyTimer);
  }, [currentRow?.rowId, threadRows.length]);

  useEffect(
    () => () => {
      if (activeContextScrollFrameRef.current != null) {
        window.cancelAnimationFrame(activeContextScrollFrameRef.current);
      }

      if (contextScrollFrameRef.current != null) {
        window.cancelAnimationFrame(contextScrollFrameRef.current);
      }
    },
    [],
  );

  const updateCurrentAnnotation = (action: SetStateAction<ChatAnnotation>) => {
    if (!currentRow) {
      return;
    }

    onAnnotationChange(currentRow.rowId, action);
  };

  const selectResponseTo = (rowId: string) => {
    updateCurrentAnnotation((current) => ({
      ...current,
      responseToId: current.responseToId === rowId ? "" : rowId,
    }));
  };

  const toggleResponsePin = (rowId: string) => {
    onResponsePinIdsChange((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId],
    );
  };

  const moveToIndex = (nextIndex: number) => {
    const nextRow = rows[nextIndex];
    if (nextRow) {
      onActiveRowChange(nextRow.rowId);
    }
  };

  const tagsForRow = (row: ChatRow): string[] => {
    const item = annotations[row.rowId] ?? emptyChatAnnotation;
    return deriveAnnotationResult(ruleSet, item.selections).finalTags;
  };

  if (!currentRow) {
    return (
      <section className="panel datasetEmpty">
        <Database size={30} />
        <h2>CSV注釈</h2>
        <p>
          チャットCSVを読み込むと、文脈タイムラインを見ながら1チャットずつタグ付けできます。
        </p>
        <button className="iconTextButton menuButton" type="button" onClick={onImportCsv}>
          <Upload size={18} />
          CSVを読み込む
        </button>
      </section>
    );
  }

  return (
    <>
      <aside className="panel contextPanel" aria-label="文脈">
        <div className="panelHeader datasetHeader">
          <div>
            <h2>文脈</h2>
            <p>{csvFileName || "CSV未選択"}</p>
          </div>
          <button className="iconTextButton compact" type="button" onClick={onImportCsv}>
            <Upload size={16} />
            読込
          </button>
        </div>

        <div className="contextControls">
          <label className="searchField">
            <span>検索</span>
            <div>
              <Search size={15} />
              <input
                value={contextSearch}
                placeholder="遠くの言及を探す"
                onChange={(event) => onContextSearchChange(event.target.value)}
              />
            </div>
          </label>
        </div>

        <div
          className="contextList primaryContextList"
          ref={contextListRef}
          tabIndex={0}
          aria-label="文脈タイムライン。上下キーでスクロールできます。"
          onScroll={scheduleContextCenterSync}
        >
          <div className="contextCenterLine" aria-hidden="true" />
          <div className="contextListHeader">
            <h3>同じスレッドの全件</h3>
            <span>{threadRows.length}件</span>
          </div>
          <div className="contextCenterSpacer" aria-hidden="true" />
          {threadRows.map((row) => {
            const isCurrent = row.rowId === currentRow.rowId;
            return (
              <ContextMessageCard
                key={row.rowId}
                cardRef={isCurrent ? activeContextCardRef : undefined}
                row={row}
                isCurrent={isCurrent}
                isResponseTo={annotation.responseToId === row.rowId}
                relation={
                  isCurrent
                    ? "現在"
                    : row.sourceIndex < currentRow.sourceIndex
                      ? "前"
                      : "後"
                }
                onJump={() => onActiveRowChange(row.rowId)}
                onResponseTo={
                  isCurrent ? undefined : () => selectResponseTo(row.rowId)
                }
              />
            );
          })}
          <div className="contextCenterSpacer" aria-hidden="true" />
        </div>

        <div className="contextList searchResults">
          <h3>検索結果</h3>
          {searchResults.length === 0 ? (
            <p className="muted smallText">キーワードに合うチャットがここに出ます。</p>
          ) : (
            searchResults.map((row) => (
              <ContextMessageCard
                key={row.rowId}
                row={row}
                isResponseTo={annotation.responseToId === row.rowId}
                relation="検索"
                onJump={() => onActiveRowChange(row.rowId)}
                onResponseTo={() => selectResponseTo(row.rowId)}
              />
            ))
          )}
        </div>
      </aside>

      <section className="panel targetPanel" aria-label="対象チャット">
        <div className="targetTopLine">
          <div>
            <p className="eyebrow">
              {currentIndex + 1} / {rows.length} ・ 注釈済み {completedCount}
            </p>
            <h2>{currentRow.speaker || currentRow.authorName || "話者不明"}</h2>
          </div>
          <div className="navButtons">
            <button
              className={`iconTextButton compact ${isCurrentPinned ? "activeSoft" : ""}`}
              type="button"
              title="応答候補としてピン"
              onClick={() => toggleResponsePin(currentRow.rowId)}
            >
              <Pin size={16} />
              {isCurrentPinned ? "ピン解除" : "ピン"}
            </button>
            <button
              className="iconButton"
              type="button"
              title="前へ"
              disabled={currentIndex <= 0}
              onClick={() => moveToIndex(currentIndex - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="iconButton"
              type="button"
              title="次へ"
              disabled={currentIndex >= rows.length - 1}
              onClick={() => moveToIndex(currentIndex + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        {hasResponseExpectedTag && (
          <p className="responseHint">
            応答が想定されるタグが付いています。必要ならこのメッセージをピンして、後続メッセージの応答先として使えます。
          </p>
        )}

        <input
          className="rowScrubber"
          type="range"
          min="0"
          max={Math.max(0, rows.length - 1)}
          value={Math.max(0, currentIndex)}
          onChange={(event) => moveToIndex(Number(event.target.value))}
        />

        <div className="messageMetaGrid">
          <span>{formatChatTime(currentRow.createdAt)}</span>
          <span>{currentRow.threadId || currentRow.channelId || "threadなし"}</span>
          <span>{currentRow.messageId || currentRow.rowId}</span>
        </div>

        <article className="targetMessage">
          <p>{currentRow.content || "本文なし"}</p>
        </article>

        <div className="currentTags">
          {result.finalTags.length === 0 ? (
            <span className="muted smallText">タグ未選択</span>
          ) : (
            result.finalTags.map((tag) => (
              <span className="tagPill" key={tag}>
                {tag}
              </span>
            ))
          )}
        </div>

        <div className="targetSummaryGrid">
          <div className="summaryBox">
            <div className="summaryTitle">
              <Pin size={15} />
              応答候補ピン
            </div>
            {responsePinnedRows.length === 0 ? (
              <p className="muted smallText">
                応答がありそうなメッセージを上のピンボタンで残せます。
              </p>
            ) : (
              <div className="centerCardList">
                {responsePinnedRows.map((row) => (
                  <CenterMessageCard
                    key={row.rowId}
                    row={row}
                    tags={tagsForRow(row)}
                    onOpen={() => setExpandedRowId(row.rowId)}
                    onJump={() => onActiveRowChange(row.rowId)}
                    onResponseTo={
                      row.rowId === currentRow.rowId
                        ? undefined
                        : () => selectResponseTo(row.rowId)
                    }
                    onTogglePin={() => toggleResponsePin(row.rowId)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="summaryBox">
            <div className="summaryTitle">
              <Link2 size={15} />
              このメッセージの応答先
            </div>
            {responseRow ? (
              <CenterMessageCard
                row={responseRow}
                tags={tagsForRow(responseRow)}
                onOpen={() => setExpandedRowId(responseRow.rowId)}
                onJump={() => onActiveRowChange(responseRow.rowId)}
                onResponseTo={() => selectResponseTo("")}
                responseActionLabel="解除"
              />
            ) : (
              <p className="muted smallText">
                左のピン、文脈、検索結果、または右の注釈パネルから応答先を指定できます。
              </p>
            )}
          </div>
        </div>

        {expandedRow && (
          <MessagePreviewModal
            row={expandedRow}
            tags={tagsForRow(expandedRow)}
            onClose={() => setExpandedRowId("")}
            onJump={() => {
              onActiveRowChange(expandedRow.rowId);
              setExpandedRowId("");
            }}
          />
        )}
      </section>

      <aside className="panel datasetAnnotationPanel" aria-label="CSV注釈">
        <div className="panelHeader datasetHeader">
          <div>
            <h2>注釈</h2>
            <p>{ruleSet.title}</p>
          </div>
          <button
            className="iconTextButton compact"
            type="button"
            disabled={rows.length === 0}
            onClick={onExportCsv}
          >
            <Download size={16} />
            CSV書出
          </button>
        </div>

        <div className="datasetSteps">
          {ruleSet.steps.map((step) => (
            <div className="runnerStep compactStep" key={step.id}>
              <div className="runnerStepHeader">
                <span className="miniBadge">{step.badge}</span>
                <strong>{step.title}</strong>
              </div>
              <p>{step.prompt}</p>
              {step.options.length > 0 && (
                <div className="choiceGrid compactChoices">
                  {step.options.map((option) => (
                    <label className="choice" key={option.id}>
                      <input
                        type={step.kind === "decision" ? "radio" : "checkbox"}
                        name={`dataset_${currentRow.rowId}_${step.id}`}
                        checked={(annotation.selections[step.id] ?? []).includes(
                          option.id,
                        )}
                        onChange={(event) =>
                          updateCurrentAnnotation((current) => ({
                            ...current,
                            selections: setSelection(
                              current.selections,
                              step,
                              option.id,
                              event.target.checked,
                            ),
                          }))
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
          <span>{hasResponseLikeTag ? "応答先" : "応答先（任意）"}</span>
          <select
            value={annotation.responseToId}
            onChange={(event) => selectResponseTo(event.target.value)}
          >
            <option value="">未指定</option>
            {responseCandidateRows.map((row) => (
              <option key={row.rowId} value={row.rowId}>
                {rowLabel(row)}
              </option>
            ))}
          </select>
        </label>

        <label className="fieldBlock">
          <span>メモ</span>
          <textarea
            rows={3}
            value={annotation.note}
            onChange={(event) =>
              updateCurrentAnnotation((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
          />
        </label>

        <div className="resultBox datasetResult">
          <div className="resultHeader">
            <CheckCircle2 size={18} />
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
        </div>
      </aside>
    </>
  );
}

function ContextMessageCard({
  cardRef,
  row,
  isCurrent = false,
  isResponseTo,
  relation,
  onJump,
  onResponseTo,
}: {
  cardRef?: RefObject<HTMLElement | null>;
  row: ChatRow;
  isCurrent?: boolean;
  isResponseTo: boolean;
  relation: string;
  onJump: () => void;
  onResponseTo?: () => void;
}) {
  return (
    <article
      className={`contextCard ${isCurrent ? "current" : ""}`}
      ref={cardRef}
      data-current-context={isCurrent ? "true" : undefined}
      data-context-row-id={row.rowId}
    >
      <div className="contextCardTop">
        <span className="contextRelation">{relation}</span>
        <strong>{row.speaker || row.authorName || "話者不明"}</strong>
        <time>{formatChatTime(row.createdAt)}</time>
      </div>
      <p>{row.content || "本文なし"}</p>
      <div className="contextActions">
        <button type="button" onClick={onJump}>
          表示
        </button>
        {onResponseTo ? (
          <button
            className={isResponseTo ? "active" : ""}
            type="button"
            onClick={onResponseTo}
          >
            応答先
          </button>
        ) : (
          <span className="contextCurrentNote">中央に表示中</span>
        )}
      </div>
    </article>
  );
}

function CenterMessageCard({
  row,
  tags,
  onOpen,
  onJump,
  onResponseTo,
  responseActionLabel = "応答先",
  onTogglePin,
}: {
  row: ChatRow;
  tags: string[];
  onOpen: () => void;
  onJump: () => void;
  onResponseTo?: () => void;
  responseActionLabel?: string;
  onTogglePin?: () => void;
}) {
  return (
    <article className="centerMessageCard">
      <button className="centerMessageMain" type="button" onClick={onOpen}>
        <span className="centerMessageMeta">
          {row.speaker || row.authorName || "話者不明"} ・ {formatChatTime(row.createdAt)}
        </span>
        <span className="centerMessageText">{brief(row.content || "本文なし", 86)}</span>
      </button>
      <div className="centerMessageTags">
        {tags.length === 0 ? (
          <span className="muted smallText">タグ未選択</span>
        ) : (
          tags.map((tag) => (
            <span className="miniTagPill" key={tag}>
              {tag}
            </span>
          ))
        )}
      </div>
      <div className="centerMessageActions">
        <button type="button" onClick={onJump}>
          表示
        </button>
        {onResponseTo && (
          <button type="button" onClick={onResponseTo}>
            {responseActionLabel}
          </button>
        )}
        {onTogglePin && (
          <button type="button" onClick={onTogglePin}>
            ピン解除
          </button>
        )}
      </div>
    </article>
  );
}

function MessagePreviewModal({
  row,
  tags,
  onClose,
  onJump,
}: {
  row: ChatRow;
  tags: string[];
  onClose: () => void;
  onJump: () => void;
}) {
  return (
    <div className="messagePreviewBackdrop" role="presentation" onMouseDown={onClose}>
      <article
        aria-label="メッセージ拡大表示"
        className="messagePreviewModal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="messagePreviewHeader">
          <div>
            <p className="eyebrow">{formatChatTime(row.createdAt)}</p>
            <h3>{row.speaker || row.authorName || "話者不明"}</h3>
          </div>
          <button className="iconButton" type="button" title="閉じる" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="messagePreviewBody">
          <p>{row.content || "本文なし"}</p>
        </div>
        <div className="messagePreviewFooter">
          <div className="centerMessageTags">
            {tags.length === 0 ? (
              <span className="muted smallText">タグ未選択</span>
            ) : (
              tags.map((tag) => (
                <span className="miniTagPill" key={tag}>
                  {tag}
                </span>
              ))
            )}
          </div>
          <button className="iconTextButton compact" type="button" onClick={onJump}>
            表示
          </button>
        </div>
      </article>
    </div>
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

function parseCsv(text: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim());
  const records = dataRows
    .filter((items) => items.some((item) => item.trim()))
    .map((items) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = items[index] ?? "";
      });
      return record;
    });

  return { headers, records };
}

function normalizeChatRow(record: Record<string, string>, index: number): ChatRow {
  const get = (key: string) => record[key]?.trim() ?? "";

  return {
    rowId: `row-${index + 1}`,
    sourceIndex: index,
    original: record,
    messageId: get("message_id"),
    threadId: get("thread_id"),
    channelId: get("channel_id"),
    speaker: get("speaker") || get("author_display_name") || get("author_name"),
    authorName: get("author_name") || get("author_display_name"),
    createdAt: get("created_at"),
    content: record.content ?? "",
    isReply: get("is_reply") === "1" || get("is_reply").toLowerCase() === "true",
    replyToMessageId: get("reply_to_message_id"),
  };
}

function buildAnnotatedChatCsv(
  headers: string[],
  rows: ChatRow[],
  annotations: Record<string, ChatAnnotation>,
  ruleSet: AnnotationRuleSet,
): string {
  const annotationHeaders = [
    "row_id",
    "Level1",
    "breakdown",
    "annotation_notes",
    "final_tags",
    "raw_tags",
    "response_to_row_id",
    "response_to_message_id",
    "annotation_payload_json",
  ];
  const outputHeaders = Array.from(new Set([...headers, ...annotationHeaders]));
  const outputRows = rows.map((row) => {
    const annotation = annotations[row.rowId] ?? emptyChatAnnotation;
    const result = deriveAnnotationResult(ruleSet, annotation.selections);
    const responseRow = rows.find((item) => item.rowId === annotation.responseToId);
    const values: Record<string, string> = { ...row.original };

    values.row_id = row.rowId;
    values.Level1 = result.finalTags.join("|");
    values.breakdown = buildAnnotationBreakdown(result);
    values.annotation_notes = annotation.note;
    values.final_tags = result.finalTags.join("|");
    values.raw_tags = result.rawTags.join("|");
    values.response_to_row_id = annotation.responseToId;
    values.response_to_message_id = responseRow?.messageId ?? "";
    values.annotation_payload_json = JSON.stringify({
      selections: annotation.selections,
      finalTags: result.finalTags,
      rawTags: result.rawTags,
      responseTo: annotation.responseToId || null,
    });

    return outputHeaders.map((header) => csvCell(values[header] ?? "")).join(",");
  });

  return [outputHeaders.map(csvCell).join(","), ...outputRows].join("\n");
}

function buildAnnotationBreakdown(result: ReturnType<typeof deriveAnnotationResult>) {
  return result.log
    .filter((item) => item.selectedLabels.length > 0 || item.tags.length > 0)
    .map((item) => {
      const labels = item.selectedLabels.join("|");
      const tags = item.tags.length > 0 ? ` -> ${item.tags.join("|")}` : "";
      return `${item.stepTitle}: ${labels}${tags}`;
    })
    .join("; ");
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function withAnnotatedSuffix(filename: string): string {
  if (filename.toLowerCase().endsWith(".csv")) {
    return filename.replace(/\.csv$/i, "-annotated.csv");
  }

  return `${filename}-annotated.csv`;
}

function uniqueRows(rows: ChatRow[]): ChatRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.rowId)) {
      return false;
    }
    seen.add(row.rowId);
    return true;
  });
}

function rowLabel(row: ChatRow): string {
  return `${row.speaker || row.authorName || "話者不明"} ${formatChatTime(
    row.createdAt,
  )} ${brief(row.content, 34)}`;
}

function brief(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength)}...`;
}

function formatChatTime(value: string): string {
  if (!value) {
    return "時刻なし";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isResponseLikeTag(tag: string): boolean {
  const value = tag.toLowerCase();
  return (
    value.includes("answer") ||
    value.includes("agreement") ||
    value.includes("disagreement") ||
    value.includes("reply") ||
    value.includes("response") ||
    value.startsWith("fb_") ||
    tag.includes("_A-")
  );
}

function isResponseExpectedTag(tag: string): boolean {
  const value = tag.toLowerCase();
  return (
    value.includes("question") ||
    value.includes("request") ||
    value.includes("check") ||
    value.includes("greeting") ||
    value.includes("thanking") ||
    value.includes("apology") ||
    value.includes("attention")
  );
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
