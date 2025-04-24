"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Upload, Plus, Play, Trash2, Eye, EyeOff, Settings } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Prompt } from "@/types"
import { ScrollArea } from "@/components/ui/scroll-area"

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

// Type for evaluation column
type EvaluationColumn = {
  id: string
  promptId: string
  modelId: string
  showPrompt: boolean
}

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

// Mock results data
const initialMockResults: ResultItem[] = [
  {
    id: "1",
    sourceText: "The ancient sword glows with mysterious energy.",
    referenceTranslation: "古代の剣は神秘的なエネルギーで輝いている。",
    outputs: [
      {
        columnId: "col1",
        text: "古代の剣は神秘的なエネルギーで輝いている。",
        score: 5,
        comment: "Excellent translation that captures the mystical tone",
        analysis:
          "1. Source Text Analysis\n- Fantasy/game item description\n- Key elements: ancient sword, mysterious energy, glow\n\n2. Translation Quality\n- Accurately conveys all key elements\n- Maintains the mystical tone of the original",
      },
      {
        columnId: "col2",
        text: "古の剣が不思議なエネルギーを放っている。",
        score: 4,
        comment: "Good alternative phrasing",
        analysis:
          "1. Source Text Analysis\n- Fantasy/game item description\n- Key elements: ancient sword, mysterious energy, glow\n\n2. Translation Quality\n- Uses alternative but valid phrasing\n- Slightly different nuance but maintains core meaning",
      },
    ],
  },
  {
    id: "2",
    sourceText: "Defeat the guardian to unlock the hidden treasure chest.",
    referenceTranslation: "守護者を倒して隠された宝箱を解放しよう。",
    outputs: [
      {
        columnId: "col1",
        text: "守護者を倒して隠された宝箱を解放しよう。",
        score: 5,
        comment: "Perfect game instruction translation",
        analysis:
          "1. Source Text Analysis\n- Game instruction/objective\n- Key elements: defeat guardian, unlock, hidden treasure chest\n\n2. Translation Quality\n- Uses appropriate game terminology\n- Maintains the instructional tone",
      },
      {
        columnId: "col2",
        text: "守護者を倒すと、隠された宝箱が開放されます。",
        score: 4,
        comment: "More informational than instructional",
        analysis:
          "1. Source Text Analysis\n- Game instruction/objective\n- Key elements: defeat guardian, unlock, hidden treasure chest\n\n2. Translation Quality\n- Changes from imperative to informational tone\n- All key information is preserved",
      },
    ],
  },
]

// --- Define Props --- M
interface EvaluationPanelProps {
  currentLanguage: string;
}

export function EvaluationPanel({ currentLanguage }: EvaluationPanelProps) {
  const [selectedProject, setSelectedProject] = useState("genshin")
  const [showIdealOutputs, setShowIdealOutputs] = useState(false)
  const [testSetType, setTestSetType] = useState("standardized")
  const [selectedTestSet, setSelectedTestSet] = useState("1")
  const [manualInput, setManualInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // State for evaluation columns
  const [columns, setColumns] = useState<EvaluationColumn[]>([
    { id: "col1", promptId: "", modelId: "1", showPrompt: false },
    { id: "col2", promptId: "", modelId: "1", showPrompt: false },
  ])

  // State for results
  const [results, setResults] = useState<ResultItem[]>(initialMockResults)

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

  // --- Fetch Prompts Effect --- M
  useEffect(() => {
    const fetchPrompts = async () => {
      setIsLoadingPrompts(true);
      setPromptsError(null);
      try {
        // Fetch prompts relevant to the current language context?
        // Adjust API endpoint if filtering by language is possible/needed
        // const fetchUrl = `/api/v1/prompts/?language=${currentLanguage}`;
        const fetchUrl = `http://localhost:8000/api/v1/prompts/`; // Fetch all for now

        const response = await fetch(fetchUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch prompts: ${response.statusText}`);
        }
        const data = await response.json();
        setAvailablePrompts(data as Prompt[]);

        // --- Initialize default columns with fetched prompts --- M
        if (data.length > 0) {
            setColumns((prevColumns) => {
                // Only update if default columns haven't been changed by user yet
                // Or maybe always update if prompts change? For now, initialize.
                if (prevColumns.every(col => col.promptId === "")) {
                    return [
                        { id: "col1", promptId: data[0].id, modelId: "1", showPrompt: false },
                        // Use second prompt if available, else first again
                        { id: "col2", promptId: data[1]?.id ?? data[0].id, modelId: "1", showPrompt: false },
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

  // Handle adding a new column
  const handleAddColumn = () => {
    const newColumnId = `col${Date.now()}`
    setColumns([
      ...columns,
      {
        id: newColumnId,
        promptId: availablePrompts[0].id,
        modelId: "1",
        showPrompt: false,
      },
    ])

    // Add empty output for this column to all existing results
    setResults(
      results.map((result) => ({
        ...result,
        outputs: [
          ...result.outputs,
          {
            columnId: newColumnId,
            text: "No translation generated yet",
            score: undefined,
            comment: "",
            analysis: "",
          },
        ],
      })),
    )
  }

  // Handle removing a column
  const handleRemoveColumn = (columnId: string) => {
    setColumns(columns.filter((col) => col.id !== columnId))

    // Remove outputs for this column from all results
    setResults(
      results.map((result) => ({
        ...result,
        outputs: result.outputs.filter((output) => output.columnId !== columnId),
      })),
    )
  }

  // Handle changing prompt for a column
  const handleChangePrompt = (columnId: string, promptId: string) => {
    setColumns(columns.map((col) => (col.id === columnId ? { ...col, promptId } : col)))
  }

  // Handle changing model for a column
  const handleChangeModel = (columnId: string, modelId: string) => {
    setColumns(columns.map((col) => (col.id === columnId ? { ...col, modelId } : col)))
  }

  // Handle toggling prompt visibility
  const handleTogglePrompt = (columnId: string) => {
    setColumns(columns.map((col) => (col.id === columnId ? { ...col, showPrompt: !col.showPrompt } : col)))
  }

  // Handle score change
  const handleScoreChange = (resultId: string, columnId: string, score: number) => {
    setResults(
      results.map((result) => {
        if (result.id === resultId) {
          return {
            ...result,
            outputs: result.outputs.map((output) => {
              if (output.columnId === columnId) {
                return { ...output, score }
              }
              return output
            }),
          }
        }
        return result
      }),
    )
  }

  // Handle comment change
  const handleCommentChange = (resultId: string, columnId: string, comment: string) => {
    setResults(
      results.map((result) => {
        if (result.id === resultId) {
          return {
            ...result,
            outputs: result.outputs.map((output) => {
              if (output.columnId === columnId) {
                return { ...output, comment }
              }
              return output
            }),
          }
        }
        return result
      }),
    )
  }

  // Get prompt name and version by ID
  const getPromptInfo = (promptId: string) => {
    const prompt = availablePrompts.find((p) => p.id === promptId);
    return prompt ? `${prompt.name} (v${prompt.version || '?.?'})` : "Select Prompt"; // Handle not found
  }

  // Get prompt text by ID
  const getPromptText = (promptId: string) => {
    const prompt = availablePrompts.find((p) => p.id === promptId);
    // Use sections if available and format, otherwise use text, fallback to empty
    if (prompt?.sections && prompt.sections.length > 0) {
        return prompt.sections.map(sec => `### ${sec.name}\n${sec.content}`).join('\n\n');
    }
    return prompt?.text || "No prompt text available"; // Handle missing text
  }

  // Get model name by ID
  const getModelName = (modelId: string) => {
    const model = mockModels.find((m) => m.id === modelId)
    return model ? model.name : "Unknown Model"
  }

  // Handle running evaluation
  const handleRunEvaluation = () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      // In a real implementation, this would fetch actual results
    }, 1500)
  }

  // Handle adding a test row
  const handleAddTestRow = () => {
    const newRowId = `row${Date.now()}`
    const newRow: ResultItem = {
      id: newRowId,
      sourceText: "Enter source text here...",
      referenceTranslation: "Enter reference translation here...",
      outputs: columns.map((column) => ({
        columnId: column.id,
        text: "No translation generated yet",
        score: undefined,
        comment: "",
        analysis: "",
      })),
    }
    setResults([...results, newRow])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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

          <div className="flex items-center space-x-2">
            <Label htmlFor="show-ideal" className="text-sm">
              Show Reference Translations
            </Label>
            <Checkbox
              id="show-ideal"
              checked={showIdealOutputs}
              onCheckedChange={(checked) => setShowIdealOutputs(!!checked)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Test Settings
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-set-type">Test Set Type</Label>
                  <Select value={testSetType} onValueChange={setTestSetType}>
                    <SelectTrigger id="test-set-type">
                      <SelectValue placeholder="Select test set type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standardized">Standardized Test Set</SelectItem>
                      <SelectItem value="upload">Upload New Set</SelectItem>
                      <SelectItem value="manual">Manual Input</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {testSetType === "standardized" && (
                  <div className="space-y-2">
                    <Label htmlFor="test-set">Test Set</Label>
                    <Select value={selectedTestSet} onValueChange={setSelectedTestSet}>
                      <SelectTrigger id="test-set">
                        <SelectValue placeholder="Select standardized test set" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockTestSets.map((testSet) => (
                          <SelectItem key={testSet.id} value={testSet.id}>
                            {testSet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {testSetType === "upload" && (
                  <div className="grid w-full gap-1.5">
                    <Label htmlFor="file-upload">Upload File</Label>
                    <div className="flex items-center justify-center w-full">
                      <label
                        htmlFor="file-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                          <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">CSV or TXT file (max. 10MB)</p>
                        </div>
                        <input id="file-upload" type="file" className="hidden" />
                      </label>
                    </div>
                  </div>
                )}

                {testSetType === "manual" && (
                  <div className="grid w-full gap-1.5">
                    <Label htmlFor="manual-input">Enter Text Samples</Label>
                    <Textarea
                      id="manual-input"
                      placeholder="Enter one text sample per line"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      className="min-h-[150px]"
                    />
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button onClick={handleRunEvaluation} disabled={isLoading}>
            <Play className="mr-2 h-4 w-4" />
            {isLoading ? "Running..." : "Run Evaluation"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evaluation Results</CardTitle>
          <CardDescription>Compare translations from different prompts</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Source Text</TableHead>
                {showIdealOutputs && <TableHead className="w-[200px]">Reference Translation</TableHead>}

                {columns.map((column) => (
                  <TableHead key={column.id} className="min-w-[250px]">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Select
                          value={column.promptId}
                          onValueChange={(value) => handleChangePrompt(column.id, value)}
                          disabled={isLoadingPrompts}
                        >
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue placeholder="Select prompt">
                              {getPromptInfo(column.promptId)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingPrompts && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                            {promptsError && <SelectItem value="error" disabled>Error loading</SelectItem>}
                            {!isLoadingPrompts && !promptsError && availablePrompts.map((prompt) => (
                              <SelectItem key={prompt.id} value={prompt.id}>
                                {prompt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTogglePrompt(column.id)}
                            className="h-8 w-8"
                          >
                            {column.showPrompt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveColumn(column.id)}
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Select value={column.modelId} onValueChange={(value) => handleChangeModel(column.id, value)}>
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {mockModels.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Prompt Preview */}
                      {column.showPrompt && (
                        <ScrollArea className="h-[100px] w-full rounded-md border bg-muted/50 mt-2 p-2">
                          <p className="text-xs font-mono whitespace-pre-wrap">
                            {getPromptText(column.promptId)}
                          </p>
                        </ScrollArea>
                      )}
                    </div>
                  </TableHead>
                ))}

                <TableHead className="w-[50px]">
                  <Button variant="ghost" size="sm" onClick={handleAddColumn} className="h-8">
                    <Plus className="h-4 w-4" />
                    Add Column
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="align-top font-medium">{result.sourceText}</TableCell>
                  {showIdealOutputs && <TableCell className="align-top">{result.referenceTranslation}</TableCell>}

                  {columns.map((column) => {
                    const output = result.outputs.find((o) => o.columnId === column.id)
                    return output ? (
                      <TableCell key={column.id} className="align-top">
                        <div className="space-y-2">
                          <p>{output.text}</p>
                          <div className="space-y-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  className={`w-6 h-6 ${
                                    (output.score || 0) >= star ? "text-yellow-500" : "text-gray-300 dark:text-gray-600"
                                  }`}
                                  onClick={() => handleScoreChange(result.id, column.id, star)}
                                >
                                  ★
                                </button>
                              ))}
                            </div>

                            <Tabs defaultValue="comment" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="comment">Comment</TabsTrigger>
                                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                              </TabsList>
                              <div className="mt-2 p-2 border rounded-md min-h-[100px] max-h-[150px] overflow-y-auto">
                                {output.comment && <div className="text-sm">{output.comment}</div>}
                                {output.analysis && (
                                  <div className="text-sm whitespace-pre-line font-mono text-xs">{output.analysis}</div>
                                )}
                              </div>
                            </Tabs>
                          </div>
                        </div>
                      </TableCell>
                    ) : (
                      <TableCell key={column.id} className="align-top">
                        <div className="text-muted-foreground">No data available</div>
                      </TableCell>
                    )
                  })}

                  <TableCell></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleAddTestRow}>
          <Plus className="mr-2 h-4 w-4" />
          Add Test Row
        </Button>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Results
        </Button>
        <Button>Save Evaluation</Button>
      </div>
    </div>
  )
}
