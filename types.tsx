export type Prompt = {
  id: string
  name: string
  description: string
  lastModified: string
  tags: string[]
  version: string
  isProduction?: boolean // Changed from isExample to isProduction
  text: string
  project?: string // Single project selection
  language?: string // Added language field
  sections?: PromptSection[] // Structured sections
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
