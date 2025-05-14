"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Upload, Plus, Play, Trash2, Eye, EyeOff, Settings, Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import type { Prompt, EvaluationResult, Evaluation, UploadedFileInfo, ColumnMapping, TestSetUploadResponse, UserTestSetSummary, TestSetEntryBase } from "@/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"
import TestSetUploadForm from './TestSetUploadForm'
import * as XLSX from 'xlsx'

// Mock data for AI models
const mockModels = [
  { id: "1", name: "GPT-4" },
  { id: "2", name: "GPT-3.5 Turbo" },
  { id: "3", name: "Claude 2" },
  { id: "4", name: "PaLM 2" },
]

// Mock data for test sets
const mockTestSets = [
  { id: "1", name: "标准测试集 1" },
  { id: "2", name: "技术文档样本" },
  { id: "3", name: "营销内容样本" },
  { id: "4", name: "游戏对话样本" },
]

// --- Update EvaluationColumn Type --- M
type EvaluationColumn = {
  id: string;
  basePromptId: string | null; // ID of the base prompt selected
  selectedVersionId: string | null; // Specific version ID selected
  modelId: string; // Keep model selection
  showPrompt: boolean;
  // State for version dropdown specific to this column
  isLoadingVersions?: boolean;
  versionsError?: string | null;
  availableVersions?: Prompt[];
}
// --- End Update ---

// Type for result item
type ResultItem = {
  id: string
  sourceText: string
  referenceTranslation?: string
  outputs: {
    columnId: string
    text: string
    score?: number
    comment?: string
    analysis?: string
  }[]
}

// --- Define Props --- M
interface EvaluationPanelProps {
  currentLanguage: string;
}

// --- Define type for editable test row state --- M
interface TestRow {
  id: string; // Frontend temporary ID
  sourceText: string;
  referenceText: string;
  additional_instructions: string; // ADDED
}

// --- Define types locally if not imported --- M
interface EvaluationRequestData {
  source_text: string;
  reference_text: string | null;
}
// --- End Define ---

// --- Constant for Select placeholder value --- M
const SELECT_PLACEHOLDER_VALUE = "--none--";
const NOT_APPLICABLE_VALUE = "--not-applicable--"; // For mapping dropdowns

// +++ ADD: Type for fetched prompt structure (copied from prompt-editor) M +++
type PromptStructure = {
  output_requirement: string;
  task_info: string;
  // character_info?: string; // Add later if needed
}
// +++ END ADD +++

// +++ ADD: Copied KNOWN_VARIABLES and variableRegex from PromptEditor M +++
const KNOWN_VARIABLES = [
    "{SOURCE_TEXT}", "{TARGET_LANGUAGE}", "{PREVIOUS_CONTEXT}", "{FOLLOWING_CONTEXT}", 
    "{TERMINOLOGY}", "{SIMILAR_TRANSLATIONS}", "{ADDITIONAL_INSTRUCTIONS}", 
    "{nameChs}", "{name}", "{gender}", "{age}", "{occupation}", 
    "{faction}", "{personality}", "{speakingStyle}", "{sampleDialogue}", "{writingStyle}" 
];
const variableRegex = new RegExp(`(${KNOWN_VARIABLES.map(v => v.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\\\$&')).join('|')})`, 'g');
// +++ END ADD +++

// +++ ADD: Copied highlightVariables function from PromptEditor M +++
// Helper function to highlight variables in text
const highlightVariables = (text: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(variableRegex);
  return parts.map((part, index) => {
    if (KNOWN_VARIABLES.includes(part)) {
      return (
        <code key={index} className="bg-primary/10 text-primary font-semibold rounded px-1 py-0.5">{part}</code>
      );
    }
    return part;
  });
};
// +++ END ADD +++

// +++ ADD: Copied TagName helper functions from PromptEditor M +++
const getTagName = (typeId: string, language: string = "en"): string => {
  const mappingEn: Record<string, string> = {
    role: "Role_Definition",
    context: "Context",
    instructions: "Instructions",
    examples: "Examples",
    output: "Output_Requirements",
    constraints: "Constraints",
  };

  const lower = (typeId || "").toLowerCase();
  if (mappingEn[lower]) return mappingEn[lower];
  return ""; 
};

const sanitizeTagName = (raw: string): string => {
  let tag = raw.trim().replace(/[^0-9a-zA-Z]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!tag || !/^[A-Za-z]/.test(tag)) tag = `C_${tag}`;
  return tag || "Custom_Section";
};

const getSectionTag = (sec: { typeId: string; name: string; }, currentLanguage: string): string => { // Simplified sec type for this context
  const mapped = getTagName(sec.typeId, currentLanguage);
  return mapped || sanitizeTagName(sec.name);
};
// +++ END ADD +++

export function EvaluationPanel({ currentLanguage }: EvaluationPanelProps) {
  const [selectedProject, setSelectedProject] = useState("genshin")
  const [showIdealOutputs, setShowIdealOutputs] = useState(false)
  const [testSetType, setTestSetType] = useState("manual") // manual, upload_new, uploaded_existing
  const [selectedTestSet, setSelectedTestSet] = useState("1")
  const [isLoading, setIsLoading] = useState(false)

  // State for modal visibility - NEW
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // --- Update Initial Columns State --- M
  const [columns, setColumns] = useState<EvaluationColumn[]>([
    { id: "col1", basePromptId: null, selectedVersionId: null, modelId: "1", showPrompt: false, availableVersions: [], isLoadingVersions: false },
    { id: "col2", basePromptId: null, selectedVersionId: null, modelId: "1", showPrompt: false, availableVersions: [], isLoadingVersions: false },
  ])
  // --- End Update ---

  // State for results
  const [evaluationResults, setEvaluationResults] = useState<EvaluationResult[]>([])
  const [currentEvaluationId, setCurrentEvaluationId] = useState<string | null>(null)
  const [evaluationStatus, setEvaluationStatus] = useState<string | null>(null)
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  const [judgeStatus, setJudgeStatus] = useState<string | null>(null)

  // ADDED: State to track if completion toast was shown
  const [isCompletionToastShown, setIsCompletionToastShown] = useState(false);

  // ADDED: State for showing sent prompts
  const [showSentPrompts, setShowSentPrompts] = useState(false);

  // Projects data
  const projects = [
    { id: "genshin", name: "Genshin" },
    { id: "honkai", name: "Honkai: Starrail" },
    { id: "zenless", name: "Zenless Zone Zero" },
  ]

  // --- State for Fetched Prompts --- M
  const [availablePrompts, setAvailablePrompts] = useState<Prompt[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  // --- End Prompt State ---

  // --- State for Editable Test Rows --- M
  const [testRows, setTestRows] = useState<TestRow[]>([
      { id: Date.now().toString(), sourceText: "", referenceText: "", additional_instructions: "" }
  ]);
  // --- End State ---

  // --- Add Pending State --- M
  const [pendingOutputs, setPendingOutputs] = useState<Set<string>>(new Set());
  // --- End Pending State ---

  // --- Add Polling State --- M
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  // --- End Polling State ---

  // --- State for uploaded test set file --- NEW
  const [uploadedTestSetFile, setUploadedTestSetFile] = useState<UploadedFileInfo | null>(null);
  const [isParsingHeaders, setIsParsingHeaders] = useState(false);
  
  // NEW states for mapping UI
  const [modalStep, setModalStep] = useState<'fileSelection' | 'columnMapping'>('fileSelection');
  const [columnMappings, setColumnMappings] = useState<ColumnMapping>({
    sourceTextColumn: null,
    referenceTextColumn: null,
    textIdColumn: null,
    extraInfoColumn: null,
  });
  const [testSetName, setTestSetName] = useState<string>("");

  // NEW States for listing and selecting existing uploaded test sets
  const [userTestSetsList, setUserTestSetsList] = useState<UserTestSetSummary[]>([]);
  const [isLoadingUserTestSets, setIsLoadingUserTestSets] = useState(false);
  const [selectedUserTestSetId, setSelectedUserTestSetId] = useState<string | null>(null);

  // +++ ADD: State for fetched backend templates M +++
  const [promptStructure, setPromptStructure] = useState<PromptStructure | null>(null);
  const [isLoadingStructure, setIsLoadingStructure] = useState(true);
  const [structureError, setStructureError] = useState<string | null>(null);
  // +++ END ADD +++

  // --- Fetch Prompts Effect --- M
  useEffect(() => {
    const fetchPrompts = async () => {
      setIsLoadingPrompts(true);
      setPromptsError(null);
      try {
        // Fetch prompts relevant to the current language context?
        // Adjust API endpoint if filtering by language is possible/needed
        // const fetchUrl = `/api/v1/prompts/?language=${currentLanguage}`;
        const data = await apiClient<Prompt[]>('/prompts/');
        setAvailablePrompts(data);

        // --- Initialize default columns with basePromptId --- M
        if (data.length > 0) {
            setColumns((prevColumns) => {
                if (prevColumns.every(col => col.basePromptId === null)) {
                    const defaultBaseId1 = data[0].base_prompt_id; // Use base_prompt_id
                    const defaultVersionId1 = data[0].id;
                    const defaultBaseId2 = data[1]?.base_prompt_id ?? defaultBaseId1;
                    const defaultVersionId2 = data[1]?.id ?? defaultVersionId1;
                    // Fetch versions for default selections immediately?
                    fetchVersionsForColumn("col1", defaultBaseId1);
                    fetchVersionsForColumn("col2", defaultBaseId2);
                    return [
                        { id: "col1", basePromptId: defaultBaseId1, selectedVersionId: defaultVersionId1, modelId: "1", showPrompt: false, availableVersions: [], isLoadingVersions: false },
                        { id: "col2", basePromptId: defaultBaseId2, selectedVersionId: defaultVersionId2, modelId: "1", showPrompt: false, availableVersions: [], isLoadingVersions: false },
                    ]
                }
                return prevColumns;
            });
        }
        // --- End Initialize ---

      } catch (err) {
        console.error("Failed to fetch prompts for evaluation panel:", err);
        setPromptsError(err instanceof Error ? err.message : "发生未知错误");
      } finally {
        setIsLoadingPrompts(false);
      }
    };
    fetchPrompts();
  // Add currentLanguage as dependency if API filtering is added later
  }, []); // Run once on mount
  // --- End Fetch Prompts ---

  // +++ ADD: Effect to fetch backend prompt structure M +++
  useEffect(() => {
    const fetchPromptStructure = async () => {
      setIsLoadingStructure(true);
      setStructureError(null);
      try {
        const data = await apiClient<PromptStructure>("/prompt-structure");
        setPromptStructure(data);
      } catch (err) {
        console.error("获取提示结构时出错:", err);
        const errorMsg = err instanceof Error ? err.message : "发生未知错误";
        setStructureError(errorMsg);
        toast.error(`加载提示结构失败： ${errorMsg}`);
        setPromptStructure(null);
      } finally {
        setIsLoadingStructure(false);
      }
    };

    fetchPromptStructure();
  }, []); // Empty dependency array means run once on mount
  // +++ END ADD +++

  // --- Function to Fetch Versions for a Column --- M
  const fetchVersionsForColumn = async (columnId: string, basePromptId: string | null) => {
    if (!basePromptId) {
        // Clear versions if base prompt is deselected
        setColumns(prev => prev.map(col => col.id === columnId ? { ...col, availableVersions: [], isLoadingVersions: false, versionsError: null } : col));
        return;
    }

    setColumns(prev => prev.map(col => col.id === columnId ? { ...col, isLoadingVersions: true, versionsError: null } : col));
    try {
        const url = `/prompts/base/${basePromptId}/versions`;
        const versionsData = await apiClient<Prompt[]>(url);
        setColumns(prev => prev.map(col => col.id === columnId ? { ...col, availableVersions: versionsData, isLoadingVersions: false } : col));
    } catch (err) {
        console.error(`Error fetching versions for column ${columnId}:`, err);
        const errorMsg = err instanceof Error ? err.message : "未知错误";
        setColumns(prev => prev.map(col => col.id === columnId ? { ...col, versionsError: errorMsg, isLoadingVersions: false, availableVersions: [] } : col));
        toast.error(`加载版本失败： ${errorMsg}`);
    }
  };
  // --- End Fetch Versions ---

  // --- Update Column Handlers --- M
  const handleAddColumn = () => {
    const newColumnId = `col${Date.now()}`;
    const firstAvailableBaseId = availablePrompts[0]?.base_prompt_id || null;
    const firstAvailableVersionId = availablePrompts[0]?.id || null;

    setColumns([
      ...columns,
      {
        id: newColumnId,
        basePromptId: firstAvailableBaseId,
        selectedVersionId: firstAvailableVersionId,
        modelId: "1", // Default model
        showPrompt: false,
        availableVersions: [],
        isLoadingVersions: !!firstAvailableBaseId, // Start loading if base prompt selected
      },
    ]);
    // Fetch versions for the newly added column if a base prompt was selected
    if (firstAvailableBaseId) {
        fetchVersionsForColumn(newColumnId, firstAvailableBaseId);
    }
    // Add empty output for this column to all existing results (if needed)
  };

  const handleRemoveColumn = (columnId: string) => {
    setColumns(columns.filter((col) => col.id !== columnId));
    // Remove outputs for this column from evaluationResults state if necessary
  };

  const handleChangeBasePrompt = (columnId: string, basePromptId: string | null) => {
      setColumns(prev => prev.map(col => {
          if (col.id === columnId) {
              // Reset version selection and fetch new versions
              const newSelectedVersionId = null; // Always reset version when base changes
              fetchVersionsForColumn(columnId, basePromptId);
              return { ...col, basePromptId, selectedVersionId: newSelectedVersionId, isLoadingVersions: !!basePromptId, versionsError: null };
          }
          return col;
      }));
  };

  const handleChangeVersion = (columnId: string, versionId: string | null) => {
       setColumns(prev => prev.map(col => col.id === columnId ? { ...col, selectedVersionId: versionId } : col));
  };

  const handleChangeModel = (columnId: string, modelId: string) => {
      setColumns(prev => prev.map((col) => (col.id === columnId ? { ...col, modelId } : col)));
  };

  const handleTogglePrompt = (columnId: string) => {
      setColumns(prev => prev.map((col) => (col.id === columnId ? { ...col, showPrompt: !col.showPrompt } : col)));
  };
  // --- End Update Handlers ---

  // Handle score change
  const handleScoreChange = async (resultId: string, columnId: string, score: number) => {
    // Optimistic UI Update
    setEvaluationResults(prevResults => prevResults.map(res =>
       res.id === resultId ? { ...res, score: score } : res
    ));

    // --- Call Backend API --- M
    console.log(`Updating score for result ${resultId} to ${score}`);
    try {
        await apiClient(`/evaluations/results/${resultId}`, {
            method: "PUT",
            body: JSON.stringify({ score: score })
        });
        // Success - state is already updated optimistically
        // Optionally show a subtle success indicator?
    } catch (error) {
        console.error(`Failed to update score for result ${resultId}:`, error);
        toast.error(`Failed to save score: ${error instanceof Error ? error.message : "Unknown error"}`);
        // TODO: Optionally revert optimistic update here
        // setEvaluationResults(prevResults => ... ); // Revert back to original score
    }
    // --- End API Call ---
  };

  // Handle comment change
  const handleCommentChange = async (resultId: string, columnId: string, comment: string) => {
       // Optimistic UI Update
       setEvaluationResults(prevResults => prevResults.map(res =>
         res.id === resultId ? { ...res, comment: comment } : res
      ));

      // --- Call Backend API --- M
      // TODO: Implement debouncing for comment input later
      console.log(`Updating comment for result ${resultId}`);
      try {
          await apiClient(`/evaluations/results/${resultId}`, {
              method: "PUT",
              body: JSON.stringify({ comment: comment })
          });
          // Success - state is already updated optimistically
      } catch (error) {
          console.error(`Failed to update comment for result ${resultId}:`, error);
          toast.error(`Failed to save comment: ${error instanceof Error ? error.message : "Unknown error"}`);
          // TODO: Optionally revert optimistic update here
      }
      // --- End API Call ---
  };

  // Get prompt name and version by ID
  const getPromptInfo = (versionId: string | null) => {
      if (!versionId) return "选择提示版本";
      // Need to find the specific version across all columns' availableVersions
      for (const col of columns) {
          const prompt = col.availableVersions?.find(p => p.id === versionId);
          if (prompt) {
              return `${prompt.name} (v${prompt.version || '?.?'})`;
          }
      }
      // Fallback if version not found in currently loaded lists (e.g., initial state)
      const latestPrompt = availablePrompts.find(p => p.id === versionId);
      return latestPrompt ? `${latestPrompt.name} (v${latestPrompt.version || '?.?'})` : "加载中...";
  };

  // Get prompt text by ID
  const getPromptText = (
    versionId: string | null,
    targetPromptStructure: PromptStructure | null,
    activeLanguage: string
  ) => {
       if (!versionId) return "未选择版本";
       if (!targetPromptStructure) return "加载提示结构中...";

       let promptToDisplay: Prompt | undefined;

       // Find the prompt in column-specific available versions first
       for (const col of columns) {
          const p = col.availableVersions?.find(p => p.id === versionId);
          if (p) {
              promptToDisplay = p;
              break;
          }
       }

       // Fallback to the general list of available prompts if not found in column versions
       if (!promptToDisplay) {
           promptToDisplay = availablePrompts.find(p => p.id === versionId);
       }

       if (!promptToDisplay) return "提示版本未找到。";

       const sections = promptToDisplay.sections;

       if (!sections || sections.length === 0) {
           // If no sections, but there's a raw text field (legacy), show that.
           // Otherwise, indicate sections are missing for a proper preview.
           if (promptToDisplay.text) return highlightVariables(promptToDisplay.text);
           return "(此提示版本无内容部分)";
       }

       const rulesXml = sections
        .map((section) => {
          // Ensure section has typeId and name for getSectionTag
          const secForTag = { typeId: section.typeId, name: section.name };
          const tag = getSectionTag(secForTag, activeLanguage);
          return `<${tag}>\n${section.content}\n</${tag}>`;
        })
        .join("\n\n");

      const fullSystemPrompt = `${rulesXml}\n\n${targetPromptStructure.output_requirement || "加载输出要求时出错..."}`;
      return highlightVariables(fullSystemPrompt);
  };

  // Get model name by ID
  const getModelName = (modelId: string) => {
    const model = mockModels.find((m) => m.id === modelId)
    return model ? model.name : "未知模型"
  }

  // Function to clear any active polling
  const clearPolling = () => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      setPollingIntervalId(null);
      console.log("Polling stopped.");
    }
  };

  // --- NEW: Function to fetch only the full results --- M
  const fetchFullEvaluationResults = async (evalId: string) => {
    if (!evalId) return;

    // Remove status fetching/checking logic from here
    // setIsLoadingResults(true); // Maybe set a specific loading state?
    console.log(`Fetching FULL results for evaluation ID: ${evalId}`);
    try {
        // 2. Fetch the results (only if still needed?)
        // If check_completion returns updated data, maybe we don't need separate results call?
        // Assuming for now we still need it:
        const resultsData = await apiClient<EvaluationResult[]>(`/evaluations/${evalId}/results`);
        setEvaluationResults(resultsData);

        // Note: Pending state update is removed, should be handled based on status polling

    } catch (error) {
        console.error("Failed fetching full results:", error);
        toast.error(`加载完整结果失败： ${error instanceof Error ? error.message : "未知错误"}`);
        // setIsLoadingResults(false);
    }
  };
  // --- End Fetch Full Results ---

  // --- NEW: Function to poll status --- M
  const pollStatus = async (evalId: string) => {
      if (!evalId) return;
      console.log(`Polling CHECK_COMPLETION for evaluation ID: ${evalId}`);
      try {
          // FIX: Call check_completion endpoint which returns the full Evaluation object
          const evalData = await apiClient<Evaluation>(`/evaluations/${evalId}/check_completion`, { method: 'PATCH' });
          console.log("[Polling] Received Eval Data from check_completion:", evalData);

          const newEvalStatus = evalData.status ?? null;
          const newJudgeStatus = evalData.judge_status ?? null;

          let shouldFetchFullResults = false;

          // Update state if status changed
          if (newEvalStatus !== evaluationStatus) {
              console.log(`[Status Poll] Evaluation status changed: ${evaluationStatus} -> ${newEvalStatus}`);
              setEvaluationStatus(newEvalStatus);
              if (newEvalStatus === 'completed' || newEvalStatus === 'failed') {
                 shouldFetchFullResults = true; // Fetch results when eval completes/fails
                 setPendingOutputs(new Set()); // Clear pending gen outputs
              }
          }
          if (newJudgeStatus !== judgeStatus) {
              console.log(`[Status Poll] Judge status changed: ${judgeStatus} -> ${newJudgeStatus}`);
              setJudgeStatus(newJudgeStatus);
              if (newJudgeStatus === 'completed' || newJudgeStatus === 'failed') {
                 shouldFetchFullResults = true; // Also fetch results when judge completes/fails
              }
          }

          // Decide whether to stop polling
          const isGenerationDone = newEvalStatus === 'completed' || newEvalStatus === 'failed';
          const isJudgeDone = newJudgeStatus === 'completed' || newJudgeStatus === 'failed' || newJudgeStatus === 'not_started' || newJudgeStatus === null;

          if (isGenerationDone && isJudgeDone) {
              // Always clear the interval if both are done
              clearPolling(); 
              // Only show toast and log stop if not already shown for this run
              if (!isCompletionToastShown) {
                  setIsCompletionToastShown(true); // Set flag immediately
                  const combinedStatus = `Eval: ${newEvalStatus ?? '-'} / Judge: ${newJudgeStatus ?? '-'}`;
                  toast.info(`评估 ${evalId} 已完成。状态： ${combinedStatus}`);
                  console.log(`Polling stopped by pollStatus (toast shown). Final Status: ${combinedStatus}`);
                  shouldFetchFullResults = true; // Ensure final results are fetched
              } else {
                  console.log(`Polling stopped by pollStatus (toast already shown). Final Status: Eval: ${newEvalStatus ?? '-'} / Judge: ${newJudgeStatus ?? '-'}`);
              }
          } else {
             // If still active, maybe fetch results less often? Or only on state change?
             // For now, fetch results only if status changed to final state (handled above)
             console.log(`[Status Poll] Still active. Eval: ${newEvalStatus}, Judge: ${newJudgeStatus}`);
          }

          // Fetch full results if needed based on status changes
          if (shouldFetchFullResults) {
              console.log("[Status Poll] Triggering fetchFullEvaluationResults based on status change.");
              fetchFullEvaluationResults(evalId);
          }

      } catch (error) {
          console.error("Failed during status poll:", error);
          toast.error(`状态轮询失败： ${error instanceof Error ? error.message : "未知错误"}`);
          // Consider stopping polling on error?
          // clearPolling();
      }
  };
  // --- End Poll Status ---

  // --- Polling Effect --- M
  useEffect(() => {
       // Determine if either generation or judging is active
       const isGenerationActive = evaluationStatus === 'pending' || evaluationStatus === 'running';
       const isJudgingActive = judgeStatus === 'pending'; // Only pending indicates active judging
 
       // --- MODIFIED: Always attempt fetch if ID exists, let fetch handle stop --- M
       if (currentEvaluationId) { 
           console.log(`Polling useEffect triggered for ${currentEvaluationId}. EvalStatus: ${evaluationStatus}, JudgeStatus: ${judgeStatus}`);
           // Clear any existing interval first
           clearPolling();
           // Call pollStatus immediately, it might trigger fetchFullEvaluationResults
           pollStatus(currentEvaluationId); 
           // Set interval - fetchFullEvaluationResults will clear this if needed
           const intervalId = setInterval(() => {
               pollStatus(currentEvaluationId); // Poll status endpoint
           }, 5000); // Poll every 5 seconds
           setPollingIntervalId(intervalId);
       } else {
           // Stop polling if no active evaluation ID
           console.log("Polling useEffect: No currentEvaluationId, stopping polling.");
           clearPolling();
       }
 
       // Cleanup function to stop polling when component unmounts or deps change
       return () => {
           clearPolling();
       };
  }, [currentEvaluationId, evaluationStatus, judgeStatus]);
  // --- End Polling Effect ---

  // --- Function to parse file headers --- NEW
  const parseFileHeaders = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          if (jsonData.length > 0) {
            const headers = jsonData[0].map(String).filter(h => h.trim() !== '');
            resolve(headers);
          } else {
            resolve([]);
          }
        } catch (error) {
          console.error("Error parsing file headers:", error);
          reject(error instanceof Error ? error.message : "Unknown error during header parsing");
        }
      };
      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        reject("Error reading file");
      };
      reader.readAsArrayBuffer(file);
    });
  };
  // --- End Parse File Headers ---

  // --- Handler for when a test set file is selected --- MODIFIED
  const handleTestSetFileSelected = async (fileInfo: UploadedFileInfo | null) => {
    // Reset states relevant to a new file upload attempt
    setUploadedTestSetFile(null);
    setIsParsingHeaders(false);
    setModalStep('fileSelection'); // Ensure we are on the file selection step
    setColumnMappings({ sourceTextColumn: null, referenceTextColumn: null, textIdColumn: null, extraInfoColumn: null });
    setTestSetName("");

    if (fileInfo && fileInfo.fileObject) {
      setIsParsingHeaders(true);
      try {
        const headers = await parseFileHeaders(fileInfo.fileObject);
        const updatedFileInfo = { ...fileInfo, headers };
        setUploadedTestSetFile(updatedFileInfo);
        setTestSetName(updatedFileInfo.name.split('.')[0]); // Pre-fill test set name from filename
        toast.success(`文件已选择: ${updatedFileInfo.name}. 表头已解析.`);
        setTestSetType("upload"); 
        setTestRows([]); 
      } catch (error) {
        toast.error(`解析表头失败: ${error}`);
        // No need to setUploadedTestSetFile(null) here as it's already cleared
      } finally {
        setIsParsingHeaders(false);
      }
    } else {
      // File was deselected or no file object
    }
  };
  // --- End Handler ---

  const handleProceedToMapping = () => {
    if (!uploadedTestSetFile || !uploadedTestSetFile.headers || uploadedTestSetFile.headers.length === 0) {
        toast.info("请选择文件并确保表头已正确解析。");
        return;
    }
    setModalStep('columnMapping');
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string | null) => {
    setColumnMappings(prev => ({ ...prev, [field]: value === NOT_APPLICABLE_VALUE ? null : value }));
  };

  const handleSaveTestSet = async () => {
    if (!testSetName.trim()) {
      toast.error("请输入测试集名称。");
      return;
    }
    if (!columnMappings.sourceTextColumn) {
      toast.error("请为源文本映射一个列。");
      return;
    }
    if (!uploadedTestSetFile || !uploadedTestSetFile.fileObject) {
      toast.error("未找到上传的文件对象。");
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadedTestSetFile.fileObject);
    formData.append('test_set_name', testSetName.trim());
    formData.append('language_code', currentLanguage); 
    formData.append('mappings', JSON.stringify(columnMappings));
    formData.append('original_file_name', uploadedTestSetFile.name);
    formData.append('file_type', uploadedTestSetFile.type);

    // TODO: Add loading state for the save button (e.g., setIsSaving(true))
    try {
      // UNCOMMENTED ACTUAL API CALL:
      const savedTestData = await apiClient<TestSetUploadResponse>( 
        '/test-sets/upload', // Corrected path: Removed leading /api/v1
        {
          method: 'POST',
          body: formData,
          // apiClient might handle Content-Type for FormData automatically,
          // but if not, you might need to explicitly set it or ensure it's not set to application/json
        }
      );
      
      toast.success(savedTestData.message || `测试集 "${savedTestData.test_set_name}" 已成功上传并处理。`);
      setIsUploadModalOpen(false); 
      fetchUserTestSets(); // REFETCH list after successful upload
      
      // TODO: Refresh list of user-uploaded test sets.
      // e.g., fetchUserTestSets(); 

    } catch (error: any) {
      console.error("Failed to save test set:", error);
      const detail = error.response?.data?.detail || error.message || "发生未知错误";
      toast.error(`保存测试集失败: ${detail}`);
    } finally {
      // TODO: Reset loading state (e.g., setIsSaving(false))
    }
  };

  const openUploadModal = () => {
    // Reset all modal-specific states when opening fresh
    setModalStep('fileSelection');
    setUploadedTestSetFile(null);
    setIsParsingHeaders(false);
    setColumnMappings({ sourceTextColumn: null, referenceTextColumn: null, textIdColumn: null, extraInfoColumn: null });
    setTestSetName("");
    setIsUploadModalOpen(true);
  };

  // --- Handler for selecting an existing uploaded test set --- MODIFIED
  const handleSelectUserTestSet = async (testSetId: string | null) => {
    setSelectedUserTestSetId(testSetId);
    setTestRows([]); // Clear existing rows immediately

    if (testSetId) {
      setTestSetType("uploaded_existing");
      setUploadedTestSetFile(null); 
      const selectedSetMeta = userTestSetsList.find(ts => ts.id === testSetId);
      toast.info(`已选择测试集: ${selectedSetMeta?.test_set_name}. 正在加载数据...`);
      
      // Fetch and populate entries for this testSetId
      try {
        // setIsLoadingTestSetEntries(true); // Optional: add a loading state for entries
        const entries = await apiClient<TestSetEntryBase[]>(`/test-sets/${testSetId}/entries`);
        
        const formattedTestRows: TestRow[] = entries.map((entry, index) => ({
          id: `uploaded-${testSetId}-${index}`, // Create a unique frontend ID
          sourceText: entry.source_text,
          referenceText: entry.reference_text || "", // Default to empty string if null
          // Assuming 'additional_instructions' is not directly in TestSetEntryBase
          // It might come from 'extra_info_value' or not be present for uploaded sets
          additional_instructions: entry.extra_info_value || "" 
        }));
        
        setTestRows(formattedTestRows);
        if (formattedTestRows.length === 0) {
            toast.info("选择的测试集没有有效数据行。");
        } else {
            toast.success(`测试集 "${selectedSetMeta?.test_set_name}" 的数据已加载 (${formattedTestRows.length} 行)。`);
        }

      } catch (error: any) {
        console.error(`Failed to fetch entries for test set ${testSetId}:`, error);
        toast.error(`加载测试集数据失败: ${error.response?.data?.detail || error.message || "未知错误"}`);
        setTestSetType("manual"); // Revert to manual on error
      } finally {
        // setIsLoadingTestSetEntries(false);
      }
    } else {
      // Switched back to e.g. manual or no selection from dropdown
      if (testSetType === "uploaded_existing") {
        setTestSetType("manual"); 
      }
    }
  };
  
  // Handle adding a test row - MODIFIED
  const handleAddTestRow = () => {
    setTestRows([...testRows, { id: Date.now().toString(), sourceText: "", referenceText: "", additional_instructions: "" }]);
    if (testSetType !== "manual") {
        toast.info("已切换到手动输入模式。");
    }
    setTestSetType("manual"); 
    setUploadedTestSetFile(null); 
    setSelectedUserTestSetId(null); // Clear selected existing test set
    setIsUploadModalOpen(false); 
  };

  // --- REINSTATE MISSING HANDLERS & handleRunEvaluation ---
  const handleTestRowChange = (id: string, field: keyof Omit<TestRow, 'id'>, value: string) => {
    setTestRows(prevRows =>
      prevRows.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const handleDeleteTestRow = (id: string) => {
    setTestRows(prevRows => prevRows.filter(row => row.id !== id));
  };

  const handleRunEvaluation = async () => {
    setIsLoading(true);
    setIsCompletionToastShown(false); 
    setEvaluationResults([]);
    setPendingOutputs(new Set());
    setCurrentEvaluationId(null);
    setEvaluationStatus("pending");
    console.log("Running evaluation with current test rows...");

    const promptIds = columns.map(col => col.selectedVersionId).filter(id => !!id);
    if (promptIds.length === 0) {
      toast.error("请在列中至少选择一个提示。");
      setIsLoading(false);
      return;
    }

    // Ensure testRows are used as the source of truth for the test set data to be sent
    let currentTestSetData: EvaluationRequestData[] = testRows.map(row => ({
        source_text: row.sourceText,
        reference_text: row.referenceText.trim() === "" ? null : row.referenceText,
        // Cast to any to include additional_instructions if your EvaluationRequestData model doesn't have it yet
        additional_instructions: (row as any).additional_instructions?.trim() === "" ? null : (row as any).additional_instructions
    })); 
    currentTestSetData = currentTestSetData.filter(item => item.source_text.trim() !== "");

    if (currentTestSetData.length === 0) {
        toast.error("请提供测试集数据 (手动输入或选择一个已上传的测试集). ");
        setIsLoading(false);
        return;
    }
    
    let currentTestSetName = "Manual Input"; // Default name
    if (testSetType === "uploaded_existing" && selectedUserTestSetId) {
        const selectedSetMeta = userTestSetsList.find(ts => ts.id === selectedUserTestSetId);
        if (selectedSetMeta) {
            currentTestSetName = selectedSetMeta.test_set_name;
        }
    }
    // If testSetType was "upload" (newly uploaded but not yet run), testRows would be populated by that flow.

    const requestBody = {
        prompt_ids: promptIds as string[],
        test_set_data: currentTestSetData,
        test_set_name: currentTestSetName
    };

    console.log("Evaluation Request Body:", requestBody);

    try {
        const evaluationData = await apiClient<Evaluation>(`/evaluations/`, {
            method: "POST",
            body: JSON.stringify(requestBody),
        });
        console.log("Evaluation started:", evaluationData);
        setCurrentEvaluationId(evaluationData.id);
        setEvaluationStatus(evaluationData.status);
        toast.success(`评估 ${evaluationData.id} 已成功开始！`);

        const initialPending = new Set<string>();
        currentTestSetData.forEach((testItem, rowIndex) => {
            // Use the ID from testRows which should be stable if populated from uploaded set
            const originalRowId = testRows[rowIndex]?.id;
            if (originalRowId) {
                 columns.forEach(col => {
                    if (col.selectedVersionId && promptIds.includes(col.selectedVersionId)) { 
                        initialPending.add(`${originalRowId}-${col.id}`);
                    }
                 });
             }
        });
        setPendingOutputs(initialPending);
        console.log("Initialized pending outputs:", initialPending);

    } catch (error: any) {
        console.error("Failed to start evaluation:", error);
        const detail = error.response?.data?.detail || error.message || "未知错误";
        toast.error(`启动评估失败: ${detail}`);
        setEvaluationStatus("failed");
    } finally {
        setIsLoading(false);
    }
  };
  // --- END REINSTATE ---

  // --- Fetch User's Uploaded Test Sets --- NEW
  const fetchUserTestSets = async () => {
    console.log("Attempting to fetch user test sets NOW..."); // DEBUG LINE
    toast.info("Refreshing test set list..."); // DEBUG LINE
    setIsLoadingUserTestSets(true);
    try {
      const data = await apiClient<UserTestSetSummary[]>('/test-sets/mine');
      setUserTestSetsList(data || []);
      if (data && data.length > 0) {
        console.log("Fetched user test sets:", data.map(d => d.id));
      } else {
        console.log("No user test sets found or empty list returned.");
      }
    } catch (error: any) {
      console.error("Failed to fetch user test sets:", error);
      toast.error(`加载用户测试集列表失败: ${error.message || "未知错误"}`);
      setUserTestSetsList([]); 
    } finally {
      setIsLoadingUserTestSets(false);
    }
  };

  useEffect(() => {
    fetchUserTestSets();
  }, [currentLanguage]);

  // --- Handler to Save Evaluation Session --- M
  const handleSaveEvaluation = async () => {
    if (!currentEvaluationId) {
      toast.error("请在保存前运行评估。");
      return;
    }
    if (evaluationResults.length === 0) {
        toast.error("当前评估没有可保存的结果。");
        return;
    }

    // 1. Gather configuration and results
    // Note: Mapping results needs care if rows/columns change after running eval
    const sessionData = {
      evaluationRunId: currentEvaluationId,
      config: {
          columns: columns.map(c => ({ // Save config of each column
              basePromptId: c.basePromptId,
              selectedVersionId: c.selectedVersionId,
              modelId: c.modelId
          })),
          testSet: testRows.map(r => ({ // Save the test set used
              sourceText: r.sourceText,
              referenceText: r.referenceText
          })),
          // Add other config like project, language if needed
          project: selectedProject,
          language: currentLanguage
      },
      // Map results including scores/comments
      // We assume evaluationResults state accurately reflects the latest feedback
      results: evaluationResults.map(res => ({
          promptId: res.prompt_id,
          sourceText: res.source_text,
          referenceText: res.reference_text,
          modelOutput: res.model_output,
          score: res.score,
          comment: res.comment,
          // Add LLM judge fields
          llm_judge_score: res.llm_judge_score,
          llm_judge_rationale: res.llm_judge_rationale,
          llm_judge_model_id: res.llm_judge_model_id
      }))
    };

    console.log("Attempting to save evaluation session:", sessionData);
    // TODO: Replace with actual saving state indicator
    toast.info("正在保存评估会话...");

    // 2. Call Backend
    try {
      // --- FIX: Use Absolute Backend URL --- M
      const backendUrl = `/evaluation-sessions/`;
      // Directly await apiClient, which handles response parsing/errors
      const savedSession = await apiClient(backendUrl, {
        method: "POST",
        body: JSON.stringify(sessionData),
      });

      console.log("Evaluation session saved:", savedSession);
      toast.success(`评估会话已成功保存 (ID: ${savedSession.id})`);

    } catch (error) {
      console.error("Failed to save evaluation session:", error);
      toast.error(`保存失败： ${error instanceof Error ? error.message : "未知错误"}`);
    }
  };
  // --- End Save Handler ---

  // --- Handler to Trigger LLM Judging --- M
  const handleRunLLMJudge = async () => {
    if (!currentEvaluationId) {
        toast.error("未选择活动的评估运行");
        return;
    }

    // Check if already running/completed (optional)
    if (judgeStatus && judgeStatus !== 'failed' && judgeStatus !== 'not_started') {
        toast.info(`此评估的 LLM 评审状态已为 ${judgeStatus}。`);
        return;
    }

    console.log(`Triggering LLM judge for evaluation: ${currentEvaluationId}`);
    toast.info("正在启动 LLM 评审流程...");
    setJudgeStatus('pending'); // Optimistic UI update

    try {
        const response = await apiClient(`/evaluations/${currentEvaluationId}/judge`, {
            method: 'POST'
        });
        // No need to parse response body if using 202 Accepted
        toast.success("LLM 评审流程已成功启动。");
        // Polling should automatically pick up the status change
    } catch (error) {
        console.error("Failed to start LLM judging:", error);
        toast.error(`启动 LLM 评审失败： ${error instanceof Error ? error.message : "未知错误"}`);
        setJudgeStatus('failed'); // Revert optimistic update
    }
  };
  // --- End Trigger Handler ---

  return (
    <div className="space-y-6">
      {/* Top Controls: Project Select, Settings, Run Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Project Selector */}
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Show Reference Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-ideal"
              checked={showIdealOutputs}
              onCheckedChange={(checked) => setShowIdealOutputs(!!checked)}
            />
            <Label htmlFor="show-ideal" className="text-sm whitespace-nowrap">
              显示参考译文
            </Label>
          </div>

          {/* ADDED: Show Sent Prompts Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-sent-prompts"
              checked={showSentPrompts}
              onCheckedChange={(checked) => setShowSentPrompts(!!checked)}
            />
            <Label htmlFor="show-sent-prompts" className="text-sm whitespace-nowrap">
              显示已发送提示
            </Label>
          </div>

        </div>

        <div className="flex items-center gap-2">
          {/* Test Settings Popover (Content removed for brevity, assuming it was correct) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                测试设置
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              {/* Add the content for Test Settings Popover here if needed */}
              <p>测试集选项将显示在此处...</p>
            </PopoverContent>
          </Popover>

          {/* Run Evaluation Button */}
          <Button onClick={handleRunEvaluation} disabled={isLoading || !!pollingIntervalId}>
            <Play className="mr-2 h-4 w-4" />
            {evaluationStatus === 'pending' || evaluationStatus === 'running' ? "运行中..." : "运行评估"}
          </Button>

          {/* Run LLM Judge Button */}
          <Button
             variant="outline"
             onClick={handleRunLLMJudge}
             disabled={!currentEvaluationId || evaluationStatus === 'pending' || evaluationStatus === 'running' || (!!judgeStatus && judgeStatus !== 'failed' && judgeStatus !== 'not_started')}
             title={!currentEvaluationId ? "请先运行评估" : (judgeStatus && judgeStatus !== 'failed' && judgeStatus !== 'not_started') ? `评审状态：${judgeStatus}` : "运行 LLM 评审评估"}
          >
            {/* Consider adding an icon e.g., <Sparkles className="mr-2 h-4 w-4" /> */}
             {judgeStatus === 'pending' ? '评审中...' : '运行 LLM 评审'}
          </Button>

          {/* Status Display */}
          {(evaluationStatus || judgeStatus) && (
             <span className="text-sm text-muted-foreground ml-2">
               评估：{evaluationStatus ?? '-'} / 评审：{judgeStatus ?? '-'}
             </span>
           )}
        </div>
      </div>

      {/* Results Card and Table */}
      <Card>
        <CardHeader>
          <CardTitle>评估结果</CardTitle>
          <CardDescription>比较不同提示的翻译</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Test Set Columns */}
                <TableHead className="w-[40%] min-w-[200px]">源文本</TableHead>
                {showIdealOutputs && <TableHead className="w-[40%] min-w-[200px]">参考译文</TableHead>}
                {/* ADDED: Additional Instructions Column Header */}
                <TableHead className="w-[20%] min-w-[150px]">附加说明</TableHead>

                {/* Prompt/Model Columns */}
                {columns.map((column) => (
                  <TableHead key={column.id} className="min-w-[300px]"> {/* Increased min-width */}
                    <div className="space-y-2">
                      {/* Base Prompt Select */}
                      <div className="flex items-center justify-between">
                        <Select
                          value={column.basePromptId ?? SELECT_PLACEHOLDER_VALUE}
                          onValueChange={(value) => handleChangeBasePrompt(column.id, value === SELECT_PLACEHOLDER_VALUE ? null : value)}
                          disabled={isLoadingPrompts}
                        >
                          <SelectTrigger className="h-8 w-full mb-1">
                            <SelectValue placeholder="选择基础提示" />
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingPrompts && <SelectItem value="loading" disabled>加载中...</SelectItem>}
                            {promptsError && <SelectItem value="error" disabled>加载错误</SelectItem>}
                            <SelectItem value={SELECT_PLACEHOLDER_VALUE}>-- 选择基础提示 --</SelectItem>
                            {!isLoadingPrompts && !promptsError && availablePrompts.map((prompt) => (
                              // Use base_prompt_id as value, display name
                              <SelectItem key={prompt.base_prompt_id} value={prompt.base_prompt_id}>
                                {prompt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Version Select */}
                      <div className="flex items-center justify-between">
                        <Select
                            value={column.selectedVersionId ?? SELECT_PLACEHOLDER_VALUE}
                            onValueChange={(value) => handleChangeVersion(column.id, value === SELECT_PLACEHOLDER_VALUE ? null : value)}
                            disabled={!column.basePromptId || column.isLoadingVersions}
                        >
                            <SelectTrigger className="h-8 w-[calc(100%-70px)]"> {/* Adjusted width */}
                                <SelectValue placeholder="选择版本" />
                            </SelectTrigger>
                            <SelectContent>
                                {column.isLoadingVersions && <SelectItem value="loading" disabled>加载中...</SelectItem>}
                                {column.versionsError && <SelectItem value="error" disabled>{column.versionsError}</SelectItem>}
                                <SelectItem value={SELECT_PLACEHOLDER_VALUE}>-- 选择版本 --</SelectItem>
                                {column.availableVersions?.map((version) => (
                                    <SelectItem key={version.id} value={version.id}>
                                        版本 {version.version}
                                        {version.is_latest ? " (最新)" : ""}
                                        {version.isProduction ? " (生产)" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {/* Action Buttons */}
                        <div className="flex items-center ml-1">
                             <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleTogglePrompt(column.id)}
                                className="h-8 w-8"
                                title={column.showPrompt ? "隐藏提示" : "显示提示"}
                             >
                               {column.showPrompt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                             </Button>
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handleRemoveColumn(column.id)}
                               className="h-8 w-8 text-destructive"
                               title="移除列"
                                disabled={columns.length <= 1} // Prevent removing last column
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                        </div>
                      </div>

                      {/* TODO: Model Select (Placeholder - UI Removed Temporarily) */}
                      {/* <div className=\"mt-1\"> ... Select component using mockModels ... </div> */}

                      {/* Prompt Preview */}
                      {column.showPrompt && (
                        <ScrollArea className="h-[100px] w-full rounded-md border bg-muted/50 mt-2 p-2">
                           <p className="text-xs font-mono whitespace-pre-wrap">
                               {/* +++ UPDATE: Pass new args to getPromptText M +++ */}
                               {getPromptText(column.selectedVersionId, promptStructure, currentLanguage)}
                               {/* +++ END UPDATE M +++ */}
                           </p>
                        </ScrollArea>
                      )}
                    </div>
                  </TableHead>
                ))}

                {/* Add Column Button Header */}
                <TableHead className="w-[100px]">
                  <Button variant="ghost" size="sm" onClick={handleAddColumn} className="h-8">
                    <Plus className="h-4 w-4 mr-1" /> 列
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testRows.map((row, index) => (
                <TableRow key={row.id}>
                  {/* Source Text Cell */}
                  <TableCell className="align-top p-1">
                    <Textarea
                      placeholder={`源文本 ${index + 1}`}
                      value={row.sourceText}
                      onChange={(e) => handleTestRowChange(row.id, 'sourceText', e.target.value)}
                      className="min-h-[80px] h-auto resize-y border-none focus-visible:ring-1 focus-visible:ring-ring p-1"
                    />
                  </TableCell>

                  {/* Reference Text Cell (Conditional) */}
                  {showIdealOutputs && (
                    <TableCell className="align-top p-1">
                       <Textarea
                         placeholder={`参考 ${index + 1}`}
                         value={row.referenceText}
                         onChange={(e) => handleTestRowChange(row.id, 'referenceText', e.target.value)}
                         className="min-h-[80px] h-auto resize-y border-none focus-visible:ring-1 focus-visible:ring-ring p-1"
                       />
                    </TableCell>
                  )}

                  {/* Additional Instructions Input Cell */}
                  <TableCell className="align-top p-1">
                     <Textarea
                       placeholder={`说明 ${index + 1}`}
                       value={row.additional_instructions}
                       onChange={(e) => handleTestRowChange(row.id, 'additional_instructions', e.target.value)}
                       className="min-h-[80px] h-auto resize-y border-none focus-visible:ring-1 focus-visible:ring-ring p-1 text-xs" // Smaller text?
                     />
                  </TableCell>

                  {/* Prompt Output/Result Cells */}
                  {columns.map((column) => {
                    const cellId = `${row.id}-${column.id}`;
                    // Determine if the initial generation is pending for this cell
                    const isGenPending = (evaluationStatus === 'pending' || evaluationStatus === 'running') && pendingOutputs.has(cellId);
                    // Find the corresponding result data
                    const output = evaluationResults.find(r =>
                        r.source_text === row.sourceText &&
                        r.prompt_id === column.selectedVersionId
                    ) as (EvaluationResult & { llm_judge_score?: number | null; llm_judge_rationale?: string | null; llm_judge_error?: string | null }) | undefined; // Added judge error type

                    const resultId = output?.id;
                    const isJudgingPending = judgeStatus === 'pending' && !!output; // Judging is pending only if output exists

                    return (
                      <TableCell key={cellId} className="align-top p-2">
                        {/* LOG 3: Log output using self-executing function */}
                        {(() => { console.log(`[Render] Row: ${row.id}, Col: ${column.id}, Output Data:`, output); return null; })()}
                        {isGenPending ? (
                          <div className="flex items-center justify-center text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin mr-1" /> 生成中...
                          </div>
                        ) : output ? (
                           <div className="space-y-2">
                              {/* --- ADDED: Sent Prompt Display (Conditional) --- */}
                              {showSentPrompts && (
                                  <ScrollArea className="h-[100px] w-full rounded-md border bg-blue-500/10 p-2 mb-2">
                                     <p className="text-xs font-medium text-muted-foreground mb-1">已发送提示 (Token数: {output.prompt_token_count ?? 'N/A'}):</p>
                                     <pre className="text-xs font-mono whitespace-pre-wrap">
                                         {/* Show System Prompt */}
                                         {output.sent_system_prompt ? (
                                             `--- 系统提示 ---\n${output.sent_system_prompt}`
                                         ) : (
                                             "(系统提示未存储)"
                                         )}
                                         {
                                         /* Add separator if both exist */
                                         output.sent_system_prompt && output.sent_user_prompt ? `\n\n--- 用户提示 ---\n` : ''
                                         }
                                         {/* Show User Prompt */}
                                         {output.sent_user_prompt ? (
                                             output.sent_system_prompt ? output.sent_user_prompt : `--- 用户提示 ---\n${output.sent_user_prompt}`
                                         ) : (
                                             output.sent_system_prompt ? '' : "(用户提示未存储)"
                                         )}
                                     </pre>
                                  </ScrollArea>
                              )}
                              {/* --- END: Sent Prompt Display --- */}

                              {/* Model Output */}
                              <p>{output.model_output || "(无输出)"}</p>

                              {/* LLM Judge Section (only if not pending judging) */}
                              {!isJudgingPending && (output.llm_judge_score !== undefined && output.llm_judge_score !== null || output.llm_judge_error) && (
                                <div className="mt-2 pt-2 border-t border-dashed">
                                  <p className="text-xs font-medium text-muted-foreground">LLM 评审：</p>
                                  {output.llm_judge_error ? (
                                      <p className="text-xs text-destructive">错误：{output.llm_judge_error}</p>
                                  ) : (
                                      <>
                                          <p className="text-sm font-semibold">分数：{output.llm_judge_score?.toFixed(1) ?? '-'}</p>
                                          {output.llm_judge_rationale && (
                                              <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">理由：</span> {output.llm_judge_rationale}</p>
                                          )}
                                      </>
                                  )}
                                </div>
                              )}
                              {isJudgingPending && (
                                 <div className="mt-2 pt-2 border-t border-dashed flex items-center justify-center text-muted-foreground text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" /> 评审中...
                                 </div>
                              )}


                              {/* Manual Score/Comment Section */}
                              <div className="space-y-1 pt-1">
                                {/* Score Input */}
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      className={`w-5 h-5 ${ (output.score || 0) >= star ? "text-yellow-500" : "text-gray-300 dark:text-gray-600" }`}
                                      onClick={() => resultId && handleScoreChange(resultId, column.id, star)}
                                      disabled={!!pollingIntervalId || isLoading || isJudgingPending}
                                    >
                                      ★
                                    </button>
                                  ))}
                                </div>
                                {/* Comment Input */}
                                <Textarea
                                  placeholder="添加评论..."
                                  value={output.comment || ""}
                                  onChange={(e) => resultId && handleCommentChange(resultId, column.id, e.target.value)}
                                  className="text-xs border rounded-md p-1 min-h-[50px] resize-y focus-visible:ring-1"
                                  rows={2}
                                  disabled={!!pollingIntervalId || isLoading || isJudgingPending}
                                />
                              </div>
                           </div>
                        ) : (
                          // Display placeholder if not pending and no result yet
                          <div className="text-muted-foreground">-</div>
                        )}
                      </TableCell>
                    );
                  })}

                  {/* Row Actions Cell */}
                  <TableCell className="align-middle p-1 text-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTestRow(row.id)}
                        disabled={testRows.length <= 1} // Disable delete for last row
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="删除行"
                        >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {/* Row for "No Results" message */}
              {testRows.length > 0 && evaluationResults.length === 0 && !isLoadingResults && !(evaluationStatus === 'pending' || evaluationStatus === 'running') && (
                    <TableRow>
                        <TableCell colSpan={columns.length + (showIdealOutputs ? 2 : 1) + 1} className="text-center text-muted-foreground py-4">
                            此评估运行尚未生成结果。
                        </TableCell>
                    </TableRow>
              )}
               {/* Row for "No Test Rows" message */}
              {testRows.length === 0 && (
                    <TableRow>
                        {/* Adjust colspan for new column */}
                        <TableCell colSpan={columns.length + (showIdealOutputs ? 3 : 2) + 1} className="text-center text-muted-foreground py-4">
                            在下方添加测试行以开始评估。
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bottom Action Buttons & Test Set Input - MODIFIED */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>测试数据输入</CardTitle>
          <CardDescription>
            选择已上传的测试集，手动添加测试行，或上传新的测试集文件。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Select Existing Test Set Section - NEW */} 
          <div className="md:col-span-1 space-y-2">
            <Label htmlFor="selectUserTestSet" className="font-semibold">选择已上传的测试集</Label>
            <Select 
              value={selectedUserTestSetId || ""}
              onValueChange={handleSelectUserTestSet}
              disabled={isLoadingUserTestSets || userTestSetsList.length === 0}
            >
              <SelectTrigger id="selectUserTestSet">
                <SelectValue placeholder={isLoadingUserTestSets ? "加载中..." : (userTestSetsList.length === 0 ? "无可用测试集" : "选择一个测试集...")} />
              </SelectTrigger>
              <SelectContent>
                {userTestSetsList.map(ts => (
                  <SelectItem key={ts.id} value={ts.id}>
                    {ts.test_set_name} ({ts.row_count} 行) - {new Date(ts.upload_timestamp).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isLoadingUserTestSets && <p className="text-xs text-muted-foreground">正在加载测试集列表...</p>}
          </div>

          {/* Manual Add Row Section - MODIFIED for layout */}
          <div className="md:col-span-1 space-y-2 flex flex-col justify-end">
            {/* <Label className="font-semibold">手动添加测试行</Label> */} 
            <Button variant="outline" onClick={handleAddTestRow} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              或手动添加测试行
            </Button>
          </div>

          {/* Upload New File Section - MODIFIED for layout */}
          <div className="md:col-span-1 space-y-2 flex flex-col justify-end">
            {/* <Label className="font-semibold">上传新文件</Label> */} 
            <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" onClick={openUploadModal}>
                  <Upload className="mr-2 h-4 w-4" />
                  上传新测试集文件
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {modalStep === 'fileSelection' ? '上传测试集文件' : '映射列并保存测试集'}
                  </DialogTitle>
                  <DialogDescription>
                    {modalStep === 'fileSelection' ? 
                      '选择一个 CSV 或 Excel 文件。文件中的第一行应为表头。' : 
                      '将文件中的列映射到标准字段，并为测试集命名。'}
                  </DialogDescription>
                </DialogHeader>
                
                {modalStep === 'fileSelection' && (
                  <div className="py-4 space-y-4">
                    <TestSetUploadForm onFileSelect={handleTestSetFileSelected} />
                    {isParsingHeaders && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />正在解析文件头...
                      </div>
                    )}
                    {uploadedTestSetFile && !isParsingHeaders && (
                      <div className="p-3 border rounded-md text-sm bg-muted/10 space-y-1">
                        <p className="font-semibold">已选文件:</p>
                        <p>名称: {uploadedTestSetFile.name}</p>
                        <p>大小: {(uploadedTestSetFile.size / 1024).toFixed(2)} KB</p>
                        {uploadedTestSetFile.headers.length > 0 ? (
                          <p>检测到的表头: <span className="font-mono bg-background p-1 rounded-sm text-xs">{uploadedTestSetFile.headers.join(', ')}</span></p>
                        ) : (
                          <p className="text-destructive">未能检测到表头或文件为空。</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {modalStep === 'columnMapping' && uploadedTestSetFile && (
                  <div className="py-4 space-y-4">
                    <div>
                      <Label htmlFor="testSetNameInput" className="font-semibold">测试集名称 <span className="text-red-500">*</span></Label>
                      <Input 
                        id="testSetNameInput" 
                        value={testSetName} 
                        onChange={(e) => setTestSetName(e.target.value)} 
                        placeholder="例如：游戏章节1对话"
                        className="mt-1"
                      />
                    </div>
                    <p className="text-sm font-semibold">列映射:</p>
                    {[ 
                      { field: 'sourceTextColumn', label: '源文本 (Source Text)', required: true },
                      { field: 'referenceTextColumn', label: '参考译文 (Reference)', required: false },
                      { field: 'textIdColumn', label: '文本ID (Text ID)', required: false },
                      { field: 'extraInfoColumn', label: '额外信息 (Extra Info)', required: false },
                    ].map(mapItem => (
                      <div key={mapItem.field}>
                        <Label htmlFor={`map-${mapItem.field}`} className="text-sm">
                          {mapItem.label} {mapItem.required && <span className="text-red-500">*</span>}
                        </Label>
                        <Select 
                          value={columnMappings[mapItem.field as keyof ColumnMapping] || NOT_APPLICABLE_VALUE}
                          onValueChange={(value) => handleMappingChange(mapItem.field as keyof ColumnMapping, value)}
                        >
                          <SelectTrigger id={`map-${mapItem.field}`} className="mt-1 w-full">
                            <SelectValue placeholder="选择列..." />
                          </SelectTrigger>
                          <SelectContent>
                            {!mapItem.required && <SelectItem value={NOT_APPLICABLE_VALUE}>--- 不适用 ---</SelectItem>}
                            {uploadedTestSetFile.headers.map(header => (
                              <SelectItem key={header} value={header}>{header}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}

                <DialogFooter>
                  {modalStep === 'fileSelection' ? (
                    <>
                      <DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose>
                      <Button 
                        type="button" 
                        onClick={handleProceedToMapping} 
                        disabled={!uploadedTestSetFile || uploadedTestSetFile.headers.length === 0 || isParsingHeaders}
                      >
                        {isParsingHeaders ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isParsingHeaders ? '解析中...' : '下一步: 映射列'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={() => setModalStep('fileSelection')}>返回</Button>
                      <Button 
                        type="button" 
                        onClick={handleSaveTestSet}
                        disabled={!testSetName.trim() || !columnMappings.sourceTextColumn}
                      >
                        保存测试集
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
           {/* ... rest of the component ... */}
          </div>
        </CardContent>
      </Card>

      {/* Original Bottom Action Buttons - now mostly for overall actions */}
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          导出结果
        </Button>
        <Button onClick={handleSaveEvaluation} disabled={!currentEvaluationId || isLoading || !!pollingIntervalId || judgeStatus === 'pending'}>
            保存评估
        </Button>
      </div>
    </div>
  );
}