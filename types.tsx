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

// --- Evaluation Result Type (Frontend) --- M
// Mimics the backend EvaluationResult model
export type EvaluationResult = {
  id: string; // Result row ID
  evaluation_id: string; // Parent evaluation session ID
  prompt_id: string; // Specific prompt version ID used
  source_text: string;
  model_output: string | null;
  reference_text: string | null;
  score: number | null;
  comment: string | null;
  created_at: string;
  // analysis?: string; // Maybe add later if backend provides it
}
// --- End NEW Type ---
