"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Upload, Plus, Play, Trash2, Eye, EyeOff, Settings, Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Prompt, EvaluationResult, Evaluation } from "@/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"

// Mock data for AI models
const mockModels = [
  { id: "1", name: "GPT-4" },
  { id: "2", name: "GPT-3.5 Turbo" },
  { id: "3", name: "Claude 2" },
  { id: "4", name: "PaLM 2" },
]

// Mock data for test sets
const mockTestSets = [
  { id: "1", name: "Standard Test Set 1" },
  { id: "2", name: "Technical Documentation Samples" },
  { id: "3", name: "Marketing Content Samples" },
  { id: "4", name: "Game Dialogue Samples" },
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

export function EvaluationPanel({ currentLanguage }: EvaluationPanelProps) {
  const [selectedProject, setSelectedProject] = useState("genshin")
  const [showIdealOutputs, setShowIdealOutputs] = useState(false)
  const [testSetType, setTestSetType] = useState("manual") // Default to manual row input
  const [selectedTestSet, setSelectedTestSet] = useState("1")
  const [isLoading, setIsLoading] = useState(false)

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
        setPromptsError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoadingPrompts(false);
      }
    };
    fetchPrompts();
  // Add currentLanguage as dependency if API filtering is added later
  }, []); // Run once on mount
  // --- End Fetch Prompts ---

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
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setColumns(prev => prev.map(col => col.id === columnId ? { ...col, versionsError: errorMsg, isLoadingVersions: false, availableVersions: [] } : col));
        toast.error(`Failed to load versions: ${errorMsg}`);
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
      if (!versionId) return "Select Prompt Version";
      // Need to find the specific version across all columns' availableVersions
      for (const col of columns) {
          const prompt = col.availableVersions?.find(p => p.id === versionId);
          if (prompt) {
              return `${prompt.name} (v${prompt.version || '?.?'})`;
          }
      }
      // Fallback if version not found in currently loaded lists (e.g., initial state)
      const latestPrompt = availablePrompts.find(p => p.id === versionId);
      return latestPrompt ? `${latestPrompt.name} (v${latestPrompt.version || '?.?'})` : "Loading...";
  };

  // Get prompt text by ID
  const getPromptText = (versionId: string | null) => {
       if (!versionId) return "No version selected";
       for (const col of columns) {
          const prompt = col.availableVersions?.find(p => p.id === versionId);
          if (prompt?.sections && prompt.sections.length > 0) {
             return prompt.sections.map(sec => `### ${sec.name}\n${sec.content}`).join('\n\n');
          }
          if (prompt?.text) return prompt.text;
       }
       const latestPrompt = availablePrompts.find(p => p.id === versionId);
       // Fallback logic as in getPromptInfo
       if (latestPrompt?.sections && latestPrompt.sections.length > 0) {
           return latestPrompt.sections.map(sec => `### ${sec.name}\n${sec.content}`).join('\n\n');
       }
       return latestPrompt?.text || "Prompt text not available";
  };

  // Get model name by ID
  const getModelName = (modelId: string) => {
    const model = mockModels.find((m) => m.id === modelId)
    return model ? model.name : "Unknown Model"
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
        toast.error(`Failed to load full results: ${error instanceof Error ? error.message : "Unknown error"}`);
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
                  toast.info(`Evaluation ${evalId} finished. Status: ${combinedStatus}`);
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
          toast.error(`Status poll failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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

  // Handle running evaluation
  const handleRunEvaluation = async () => {
    setIsLoading(true);
    // Reset completion flag for new run
    setIsCompletionToastShown(false); 
    // --- Clear previous results and pending state --- M
    setEvaluationResults([]);
    setPendingOutputs(new Set());
    setCurrentEvaluationId(null);
    setEvaluationStatus("pending");
    console.log("Running evaluation...");

    const promptIds = columns.map(col => col.selectedVersionId).filter(id => !!id);
    if (promptIds.length === 0) {
      toast.error("Please select at least one prompt in the columns.");
      setIsLoading(false);
      return;
    }

    let testSetData: EvaluationRequestData[] = testRows.map(row => ({
        source_text: row.sourceText,
        reference_text: row.referenceText.trim() === "" ? null : row.referenceText,
        additional_instructions: row.additional_instructions.trim() === "" ? null : row.additional_instructions
    }));
    testSetData = testSetData.filter(item => item.source_text.trim() !== "");

    if (testSetData.length === 0) {
        toast.error("Please provide test set data (Manual Input).");
        setIsLoading(false);
        return;
    }

    const requestBody = {
        prompt_ids: promptIds,
        test_set_data: testSetData,
        test_set_name: "Manual Input"
    };

    console.log("Evaluation Request Body:", requestBody);

    try {
        const evaluationData = await apiClient<Evaluation>(`/evaluations/`, {
            method: "POST",
            body: JSON.stringify(requestBody),
        });
        // --- Use returned data directly --- M
        console.log("Evaluation started:", evaluationData);
        setCurrentEvaluationId(evaluationData.id);
        setEvaluationStatus(evaluationData.status);
        toast.success(`Evaluation ${evaluationData.id} started successfully!`);
        // --- End Use ---

        // --- ADDED: Populate pendingOutputs --- M
        const initialPending = new Set<string>();
        // Use the filtered testSetData that was actually sent
        testSetData.forEach((testItem, rowIndex) => {
            // Find the original row ID (assuming testRows order matches testSetData)
            const originalRowId = testRows.find(r => r.sourceText === testItem.source_text)?.id;
            if (originalRowId) {
                 columns.forEach(col => { // Iterate through columns with selected versions
                    if (col.selectedVersionId && promptIds.includes(col.selectedVersionId)) { // Ensure the column was part of the request
                        initialPending.add(`${originalRowId}-${col.id}`);
                    }
                 });
             }
        });
        setPendingOutputs(initialPending);
        console.log("Initialized pending outputs:", initialPending);
        // --- End Populate --- M

    } catch (error) {
        console.error("Failed to start evaluation:", error);
        toast.error(`Failed to start evaluation: ${error instanceof Error ? error.message : "Unknown error"}`);
        setEvaluationStatus("failed");
    } finally {
        setIsLoading(false);
    }
  };

  // Handle adding a test row
  const handleAddTestRow = () => {
    setTestRows([...testRows, { id: Date.now().toString(), sourceText: "", referenceText: "", additional_instructions: "" }]);
  };

  const handleDeleteTestRow = (id: string) => {
      // Prevent deleting the last row? Optional.
      if (testRows.length <= 1) {
          toast.info("Cannot delete the last test row.");
          return;
      }
      setTestRows(testRows.filter(row => row.id !== id));
      // TODO: Also clear any evaluation results associated with this row if needed
  };

  const handleTestRowChange = (id: string, field: keyof Omit<TestRow, 'id'>, value: string) => {
    setTestRows(prevRows =>
      prevRows.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  // --- Handler to Save Evaluation Session --- M
  const handleSaveEvaluation = async () => {
    if (!currentEvaluationId) {
      toast.error("Please run an evaluation before saving.");
      return;
    }
    if (evaluationResults.length === 0) {
        toast.error("No results available to save for the current evaluation.");
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
    toast.info("Saving evaluation session...");

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
      toast.success(`Evaluation session saved successfully (ID: ${savedSession.id})`);

    } catch (error) {
      console.error("Failed to save evaluation session:", error);
      toast.error(`Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  // --- End Save Handler ---

  // --- Handler to Trigger LLM Judging --- M
  const handleRunLLMJudge = async () => {
    if (!currentEvaluationId) {
        toast.error("No active evaluation run selected");
        return;
    }

    // Check if already running/completed (optional)
    if (judgeStatus && judgeStatus !== 'failed' && judgeStatus !== 'not_started') {
        toast.info(`LLM judging is already ${judgeStatus} for this evaluation.`);
        return;
    }

    console.log(`Triggering LLM judge for evaluation: ${currentEvaluationId}`);
    toast.info("Initiating LLM judge process...");
    setJudgeStatus('pending'); // Optimistic UI update

    try {
        const response = await apiClient(`/evaluations/${currentEvaluationId}/judge`, {
            method: 'POST'
        });
        // No need to parse response body if using 202 Accepted
        toast.success("LLM judging process started successfully.");
        // Polling should automatically pick up the status change
    } catch (error) {
        console.error("Failed to start LLM judging:", error);
        toast.error(`Failed to start LLM judging: ${error instanceof Error ? error.message : "Unknown error"}`);
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
              <SelectValue placeholder="Select project" />
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
              Show Reference Translations
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
              Show Sent Prompts
            </Label>
          </div>

        </div>

        <div className="flex items-center gap-2">
          {/* Test Settings Popover (Content removed for brevity, assuming it was correct) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Test Settings
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              {/* Add the content for Test Settings Popover here if needed */}
              <p>Test set options will go here...</p>
            </PopoverContent>
          </Popover>

          {/* Run Evaluation Button */}
          <Button onClick={handleRunEvaluation} disabled={isLoading || !!pollingIntervalId}>
            <Play className="mr-2 h-4 w-4" />
            {evaluationStatus === 'pending' || evaluationStatus === 'running' ? "Running..." : "Run Evaluation"}
          </Button>

          {/* Run LLM Judge Button */}
          <Button
             variant="outline"
             onClick={handleRunLLMJudge}
             disabled={!currentEvaluationId || evaluationStatus === 'pending' || evaluationStatus === 'running' || (!!judgeStatus && judgeStatus !== 'failed' && judgeStatus !== 'not_started')}
             title={!currentEvaluationId ? "Run an evaluation first" : (judgeStatus && judgeStatus !== 'failed' && judgeStatus !== 'not_started') ? `Judging status: ${judgeStatus}` : "Run LLM Judge Evaluation"}
          >
            {/* Consider adding an icon e.g., <Sparkles className="mr-2 h-4 w-4" /> */}
             {judgeStatus === 'pending' ? 'Judging...' : 'Run LLM Judge'}
          </Button>

          {/* Status Display */}
          {(evaluationStatus || judgeStatus) && (
             <span className="text-sm text-muted-foreground ml-2">
               Eval: {evaluationStatus ?? '-'} / Judge: {judgeStatus ?? '-'}
             </span>
           )}
        </div>
      </div>

      {/* Results Card and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Results</CardTitle>
          <CardDescription>Compare translations from different prompts</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Test Set Columns */}
                <TableHead className="w-[40%] min-w-[200px]">Source Text</TableHead>
                {showIdealOutputs && <TableHead className="w-[40%] min-w-[200px]">Reference Translation</TableHead>}
                {/* ADDED: Additional Instructions Column Header */}
                <TableHead className="w-[20%] min-w-[150px]">Additional Instructions</TableHead>

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
                            <SelectValue placeholder="Select Base Prompt" />
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingPrompts && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                            {promptsError && <SelectItem value="error" disabled>Error loading</SelectItem>}
                            <SelectItem value={SELECT_PLACEHOLDER_VALUE}>-- Select Base Prompt --</SelectItem>
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
                                <SelectValue placeholder="Select Version" />
                            </SelectTrigger>
                            <SelectContent>
                                {column.isLoadingVersions && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                                {column.versionsError && <SelectItem value="error" disabled>{column.versionsError}</SelectItem>}
                                <SelectItem value={SELECT_PLACEHOLDER_VALUE}>-- Select Version --</SelectItem>
                                {column.availableVersions?.map((version) => (
                                    <SelectItem key={version.id} value={version.id}>
                                        Version {version.version}
                                        {version.is_latest ? " (Latest)" : ""}
                                        {version.isProduction ? " (Prod)" : ""}
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
                                title={column.showPrompt ? "Hide Prompt" : "Show Prompt"}
                              >
                                {column.showPrompt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveColumn(column.id)}
                                className="h-8 w-8 text-destructive"
                                title="Remove Column"
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
                               {getPromptText(column.selectedVersionId)}
                           </p>
                        </ScrollArea>
                      )}
                    </div>
                  </TableHead>
                ))}

                {/* Add Column Button Header */}
                <TableHead className="w-[100px]">
                  <Button variant="ghost" size="sm" onClick={handleAddColumn} className="h-8">
                    <Plus className="h-4 w-4 mr-1" /> Col
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
                      placeholder={`Source ${index + 1}`}
                      value={row.sourceText}
                      onChange={(e) => handleTestRowChange(row.id, 'sourceText', e.target.value)}
                      className="min-h-[80px] h-auto resize-y border-none focus-visible:ring-1 focus-visible:ring-ring p-1"
                    />
                  </TableCell>

                  {/* Reference Text Cell (Conditional) */}
                  {showIdealOutputs && (
                    <TableCell className="align-top p-1">
                       <Textarea
                         placeholder={`Reference ${index + 1}`}
                         value={row.referenceText}
                         onChange={(e) => handleTestRowChange(row.id, 'referenceText', e.target.value)}
                         className="min-h-[80px] h-auto resize-y border-none focus-visible:ring-1 focus-visible:ring-ring p-1"
                       />
                    </TableCell>
                  )}

                  {/* Additional Instructions Input Cell */}
                  <TableCell className="align-top p-1">
                     <Textarea
                       placeholder={`Instructions ${index + 1}`}
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
                            <Loader2 className="h-4 w-4 animate-spin mr-1" /> Generating...
                          </div>
                        ) : output ? (
                           <div className="space-y-2">
                              {/* --- ADDED: Sent Prompt Display (Conditional) --- */}
                              {showSentPrompts && (
                                  <ScrollArea className="h-[100px] w-full rounded-md border bg-blue-500/10 p-2 mb-2">
                                     <p className="text-xs font-medium text-muted-foreground mb-1">Sent Prompt (Tokens: {output.prompt_token_count ?? 'N/A'}):</p>
                                     <pre className="text-xs font-mono whitespace-pre-wrap">
                                         {/* Show System Prompt */}
                                         {output.sent_system_prompt ? (
                                             `--- SYSTEM PROMPT ---\n${output.sent_system_prompt}`
                                         ) : (
                                             "(System prompt not stored)"
                                         )}
                                         {
                                         /* Add separator if both exist */
                                         output.sent_system_prompt && output.sent_user_prompt ? `\n\n--- USER PROMPT ---\n` : ''
                                         }
                                         {/* Show User Prompt */}
                                         {output.sent_user_prompt ? (
                                             output.sent_system_prompt ? output.sent_user_prompt : `--- USER PROMPT ---\n${output.sent_user_prompt}`
                                         ) : (
                                             output.sent_system_prompt ? '' : "(User prompt not stored)"
                                         )}
                                     </pre>
                                  </ScrollArea>
                              )}
                              {/* --- END: Sent Prompt Display --- */}

                              {/* Model Output */}
                              <p>{output.model_output || "(No output)"}</p>

                              {/* LLM Judge Section (only if not pending judging) */}
                              {!isJudgingPending && (output.llm_judge_score !== undefined && output.llm_judge_score !== null || output.llm_judge_error) && (
                                <div className="mt-2 pt-2 border-t border-dashed">
                                  <p className="text-xs font-medium text-muted-foreground">LLM Judge:</p>
                                  {output.llm_judge_error ? (
                                      <p className="text-xs text-destructive">Error: {output.llm_judge_error}</p>
                                  ) : (
                                      <>
                                          <p className="text-sm font-semibold">Score: {output.llm_judge_score?.toFixed(1) ?? '-'}</p>
                                          {output.llm_judge_rationale && (
                                              <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Rationale:</span> {output.llm_judge_rationale}</p>
                                          )}
                                      </>
                                  )}
                                </div>
                              )}
                              {isJudgingPending && (
                                 <div className="mt-2 pt-2 border-t border-dashed flex items-center justify-center text-muted-foreground text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" /> Judging...
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
                                  placeholder="Add comment..."
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
                        title="Delete row"
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
                            No results generated for this evaluation run yet.
                        </TableCell>
                    </TableRow>
              )}
               {/* Row for "No Test Rows" message */}
              {testRows.length === 0 && (
                    <TableRow>
                        {/* Adjust colspan for new column */}
                        <TableCell colSpan={columns.length + (showIdealOutputs ? 3 : 2) + 1} className="text-center text-muted-foreground py-4">
                            Add test rows below to start an evaluation.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bottom Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleAddTestRow}>
          <Plus className="mr-2 h-4 w-4" />
          Add Test Row
        </Button>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Results
        </Button>
        <Button onClick={handleSaveEvaluation} disabled={!currentEvaluationId || isLoading || !!pollingIntervalId || judgeStatus === 'pending'}>
            Save Evaluation
        </Button>
      </div>
    </div>
  );
}