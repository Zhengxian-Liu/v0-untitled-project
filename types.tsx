export type Prompt = {
  id: string // Matches backend ObjectId serialized as string
  name: string
  description: string
  sections: PromptSection[] // Expect structured sections from backend
  text?: string // Text is now optional
  created_at: string // Backend sends ISO format datetime string
  updated_at: string // Backend sends ISO format datetime string

  // Re-added fields (now sent by backend)
  tags: string[] // Should now be present, defaulting to [] if not sent
  project?: string // Optional
  language?: string // Optional
  isProduction?: boolean // Optional, defaults to false on backend
  version?: string // Optional, defaults to "1.0" on backend

  // Fields NOT currently sent by basic backend Prompt model:
  // lastModified: string
  // sections?: PromptSection[]
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

// --- NEW: Prompt History Type (Frontend) --- M
// Mimics the backend PromptHistory model structure returned by the API
export type PromptHistory = {
  id: string // The ID of the history record itself
  prompt_id: string // ID of the main prompt it belongs to
  saved_at: string // Timestamp when this history record was saved (ISO string)
  // --- Fields copied from Prompt state ---
  name: string
  description?: string
  sections: PromptSection[]
  tags: string[]
  project?: string
  language?: string
  isProduction: boolean
  version: string
}
// --- End NEW Type ---
