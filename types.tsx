export type Prompt = {
  id: string // This is now the VERSION ID
  name: string
  description: string
  sections: PromptSection[]
  text?: string
  created_at: string
  updated_at: string
  tags: string[]
  project?: string
  language?: string
  isProduction?: boolean
  version?: string
  // --- Add Versioning Fields --- M
  base_prompt_id: string // ID linking all versions of a prompt
  is_latest: boolean // Is this the latest version?
  // --- End Versioning Fields ---
}

export type PromptSection = {
  id: string
  type: string
  name: string
  content: string
}

export type SavedSection = {
  id: string
  name: string
  type: string
  content: string
}

export type Template = {
  id: string
  name: string
  description: string
  text: string
}

export type Snippet = {
  id: string
  name: string
  text: string
}

export type ResultItem = {
  id: string
  sourceText: string
  referenceTranslation?: string
  outputs: {
    promptId: string
    promptName: string
    text: string
    score?: number
    comment?: string
  }[]
}

// Add a type to track production prompts
export type ProductionPrompt = {
  id: string
  project: string
  language: string
  promptId: string
  promptName: string
}

// --- Evaluation Types (Consolidated) --- M

// For results fetched from the backend during/after an evaluation run
export type EvaluationResult = {
  id: string; // Result row ID from evaluation_results collection
  evaluation_id: string;
  prompt_id: string; // Specific prompt version ID used
  source_text: string;
  model_output: string | null;
  reference_text: string | null;
  score: number | null;
  comment: string | null;
  created_at: string;
}

// For representing saved evaluation sessions

export type EvaluationSessionConfigColumn = {
  basePromptId: string | null;
  selectedVersionId: string | null;
  modelId: string | null;
}

export type EvaluationSessionTestItem = {
  sourceText: string;
  referenceText: string | null;
}

export type EvaluationSessionConfig = {
  columns: EvaluationSessionConfigColumn[];
  testSet: EvaluationSessionTestItem[];
  project: string | null;
  language: string | null;
}

export type EvaluationSessionResultItem = { // Renamed to avoid conflict
  promptId: string | null;
  sourceText: string;
  referenceText: string | null;
  modelOutput: string | null;
  score: number | null;
  comment: string | null;
}

export type EvaluationSession = {
  id: string; // Saved Session ID
  session_name: string;
  session_description: string | null;
  saved_at: string;
  config: EvaluationSessionConfig;
  results: EvaluationSessionResultItem[]; // Use renamed type
}

export type EvaluationSessionSummary = {
  id: string;
  session_name: string;
  session_description: string | null;
  saved_at: string;
}

// --- End Evaluation Types ---
