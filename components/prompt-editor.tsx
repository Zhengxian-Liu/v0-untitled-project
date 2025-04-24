"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import {
  ChevronDown,
  Save,
  GitBranch,
  Code,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  BookmarkPlus,
  Bookmark,
  AlertTriangle,
  History,
} from "lucide-react"
import type { Prompt, PromptSection, SavedSection, PromptHistory, ProductionPrompt } from "@/types"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Template = {
  id: string
  name: string
  description: string
  text: string
}

type Snippet = {
  id: string
  name: string
  text: string
}

const templates: Template[] = [
  {
    id: "1",
    name: "Basic Translation Template",
    description: "A simple template for general translation tasks",
    text: "You are a translator specializing in [SOURCE_LANGUAGE] to [TARGET_LANGUAGE] translations. Translate the following text, maintaining the original meaning, tone, and style as closely as possible.",
  },
  {
    id: "2",
    name: "Technical Documentation Template",
    description: "Optimized for technical content translation",
    text: "You are a technical translator specializing in [SOURCE_LANGUAGE] to [TARGET_LANGUAGE] translations. Translate the following technical documentation, maintaining all technical terminology accurately. Preserve formatting such as bullet points and numbered lists.",
  },
]

const snippets: Snippet[] = [
  {
    id: "1",
    name: "Preserve Formatting",
    text: "Preserve all formatting including bullet points, numbered lists, and paragraph breaks.",
  },
  {
    id: "2",
    name: "Cultural Adaptation",
    text: "Adapt any cultural references to be appropriate for the target audience while maintaining the original meaning.",
  },
]

const availableTags = ["Technical", "Marketing", "Legal", "Conversational", "Formal", "Casual"]

const availableProjects = [
  { id: "genshin", name: "Genshin" },
  { id: "honkai", name: "Honkai: Starrail" },
  { id: "zenless", name: "Zenless Zone Zero" },
]

const availableLanguages = [
  { id: "en", name: "English" },
  { id: "ja", name: "Japanese" },
  { id: "ko", name: "Korean" },
  { id: "zh", name: "Chinese" },
  { id: "fr", name: "French" },
  { id: "de", name: "German" },
  { id: "es", name: "Spanish" },
  { id: "it", name: "Italian" },
  { id: "ru", name: "Russian" },
  { id: "pt", name: "Portuguese" },
]

const sectionTypes = [
  { id: "role", name: "Role Definition" },
  { id: "context", name: "Context" },
  { id: "instructions", name: "Instructions" },
  { id: "examples", name: "Examples" },
  { id: "output", name: "Output Requirements" },
  { id: "constraints", name: "Constraints" },
  { id: "custom", name: "Custom Section" },
]

// Mock saved sections that could be reused across prompts
const mockSavedSections: SavedSection[] = [
  {
    id: "1",
    name: "Standard Translator Role",
    type: "role",
    content:
      "You are a professional translator specializing in game localization from [SOURCE_LANGUAGE] to [TARGET_LANGUAGE].",
  },
  {
    id: "2",
    name: "Character Voice Preservation",
    type: "instructions",
    content:
      "Maintain the character's unique voice and personality traits in the translation. Pay special attention to speech patterns, catchphrases, and verbal tics that define the character.",
  },
  {
    id: "3",
    name: "Game Terminology Consistency",
    type: "context",
    content:
      "This game uses specific terminology for items, abilities, and locations. Refer to the glossary and ensure consistent translation of these terms.",
  },
  {
    id: "4",
    name: "Dialogue Example",
    type: "examples",
    content:
      'Source: "さあ、冒険を始めよう！"\nTranslation: "Now, let\'s begin our adventure!"\n\nSource: "この剣の力を見せてやる！"\nTranslation: "I\'ll show you the power of this sword!"',
  },
  {
    id: "5",
    name: "Standard Output Format",
    type: "output",
    content: "Provide translations in the following format:\n1. Source text\n2. Translation\n3. Notes (if any)",
  },
]

// Mock data for production prompts
const mockProductionPrompts: ProductionPrompt[] = [
  {
    id: "prod1",
    project: "genshin",
    language: "ja",
    promptId: "1",
    promptName: "Technical Documentation Translation",
  },
  {
    id: "prod2",
    project: "honkai",
    language: "fr",
    promptId: "2",
    promptName: "Marketing Content Translation",
  },
  {
    id: "prod3",
    project: "zenless",
    language: "es",
    promptId: "3",
    promptName: "Legal Document Translation",
  },
]

// --- Define Props Type --- M
interface PromptEditorProps {
  prompt: Prompt | null;
  onSaveSuccess?: () => void; // Make callback optional
}

// --- Constant for Select placeholder value --- M
const SELECT_PLACEHOLDER_VALUE = "--none--";

// Use the Props type
export function PromptEditor({ prompt, onSaveSuccess }: PromptEditorProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined)
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(undefined)
  const [isProduction, setIsProduction] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [version, setVersion] = useState("1.0")
  const [sections, setSections] = useState<PromptSection[]>([
    { id: "1", type: "role", name: "Role Definition", content: "" },
    { id: "2", type: "context", name: "Context", content: "" },
    { id: "3", type: "instructions", name: "Instructions", content: "" },
  ])
  const [showSaveSectionDialog, setShowSaveSectionDialog] = useState(false)
  const [sectionToSave, setSectionToSave] = useState<PromptSection | null>(null)
  const [newSectionName, setNewSectionName] = useState("")
  const [showInsertSectionDialog, setShowInsertSectionDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // --- Re-introduce state for production check --- M
  const [currentProductionPrompt, setCurrentProductionPrompt] = useState<Prompt | null>(null)
  const [isLoadingProductionCheck, setIsLoadingProductionCheck] = useState(false)
  const [showProductionConfirmDialog, setShowProductionConfirmDialog] = useState(false)
  // --- End re-introduction ---

  // --- State for History --- M
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [promptHistory, setPromptHistory] = useState<PromptHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // --- End History State ---

  useEffect(() => {
    if (prompt) {
      // Load state from the passed prompt object
      setName(prompt.name || "")
      setDescription(prompt.description || "")
      setSections(prompt.sections && prompt.sections.length > 0 ? prompt.sections : [])
      setSelectedTags(prompt.tags || [])
      setSelectedProject(prompt.project)
      setSelectedLanguage(prompt.language)
      setIsProduction(prompt.isProduction || false)
      setVersion(prompt.version || "1.0")
    } else {
      // Reset form for new prompt (set default sections)
      setName("")
      setDescription("")
      setIsProduction(false)
      setSelectedTags([])
      setSelectedProject(undefined)
      setSelectedLanguage(undefined)
      setVersion("1.0")
      setSections([
        { id: "1", type: "role", name: "Role Definition", content: "" },
        { id: "2", type: "context", name: "Context", content: "" },
        { id: "3", type: "instructions", name: "Instructions", content: "" },
      ])
    }
  }, [prompt])

  // --- NEW: Effect to check for existing production prompt --- M
  useEffect(() => {
    const fetchCurrentProductionPrompt = async () => {
      if (selectedProject && selectedLanguage) {
        setIsLoadingProductionCheck(true);
        setCurrentProductionPrompt(null); // Reset before fetching
        try {
          const url = `http://localhost:8000/api/v1/prompts/production/?project=${encodeURIComponent(selectedProject)}&language=${encodeURIComponent(selectedLanguage)}`;
          const response = await fetch(url);

          if (response.ok) {
            const data: Prompt = await response.json();
            setCurrentProductionPrompt(data);
            console.log("Found current production prompt:", data);
          } else if (response.status === 404) {
            // 404 is expected if no production prompt exists
            setCurrentProductionPrompt(null);
            console.log("No existing production prompt found for:", selectedProject, selectedLanguage);
          } else {
            // Handle other errors
            console.error("Error fetching production prompt status:", response.statusText);
             setCurrentProductionPrompt(null); // Assume none on error
          }
        } catch (error) {
          console.error("Failed to fetch production prompt status:", error);
           setCurrentProductionPrompt(null); // Assume none on error
        } finally {
          setIsLoadingProductionCheck(false);
        }
      } else {
        // If project or language is not selected, there's no specific production prompt to check
        setCurrentProductionPrompt(null);
      }
    };

    fetchCurrentProductionPrompt();
  }, [selectedProject, selectedLanguage]);
  // --- End NEW Effect ---

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handleTemplateSelect = (template: Template) => {
    // When selecting a template, replace the first section with the template text
    if (sections.length > 0) {
      const newSections = [...sections]
      newSections[0].content = template.text
      setSections(newSections)
    } else {
      setSections([{ id: "1", type: "instructions", name: "Instructions", content: template.text }])
    }
  }

  const handleSnippetInsert = (snippet: Snippet, sectionId: string) => {
    // Insert snippet into the specified section
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          return {
            ...section,
            content: section.content + "\n\n" + snippet.text,
          }
        }
        return section
      }),
    )
  }

  const handleSectionContentChange = (sectionId: string, content: string) => {
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          return { ...section, content }
        }
        return section
      }),
    )
  }

  const handleSectionTypeChange = (sectionId: string, type: string) => {
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          const sectionType = sectionTypes.find((t) => t.id === type)
          return {
            ...section,
            type,
            name: type === "custom" ? section.name : sectionType?.name || section.name,
          }
        }
        return section
      }),
    )
  }

  const handleSectionNameChange = (sectionId: string, name: string) => {
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          return { ...section, name }
        }
        return section
      }),
    )
  }

  const handleAddSection = () => {
    const newId = Date.now().toString()
    setSections([...sections, { id: newId, type: "custom", name: "New Section", content: "" }])
  }

  const handleDeleteSection = (sectionId: string) => {
    setSections(sections.filter((section) => section.id !== sectionId))
  }

  const handleMoveSection = (sectionId: string, direction: "up" | "down") => {
    const index = sections.findIndex((section) => section.id === sectionId)
    if ((direction === "up" && index === 0) || (direction === "down" && index === sections.length - 1)) {
      return // Can't move further in this direction
    }

    const newSections = [...sections]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    const temp = newSections[index]
    newSections[index] = newSections[targetIndex]
    newSections[targetIndex] = temp

    setSections(newSections)
  }

  const handleSaveSection = (section: PromptSection) => {
    setSectionToSave(section)
    setNewSectionName(section.name)
    setShowSaveSectionDialog(true)
  }

  const confirmSaveSection = () => {
    // In a real app, this would save to a database
    console.log("Saving section:", { ...sectionToSave, name: newSectionName })
    setShowSaveSectionDialog(false)
  }

  const handleInsertSavedSection = (savedSection: SavedSection) => {
    const newId = Date.now().toString()
    setSections([
      ...sections,
      {
        id: newId,
        type: savedSection.type,
        name: savedSection.name,
        content: savedSection.content,
      },
    ])
    setShowInsertSectionDialog(false)
  }

  // Add a function to assemble the complete prompt from all sections
  const assembleCompletePrompt = () => {
    return sections
      .map((section) => {
        return `### ${section.name}\n${section.content}`
      })
      .join("\n\n")
  }

  // --- MODIFIED: Restore production check logic --- M
  const handleProductionChange = (checked: boolean) => {
    // Check if we are trying to set THIS prompt to production
    if (checked) {
       // Check if there IS a current production prompt AND it's DIFFERENT from the one being edited
       if (currentProductionPrompt && currentProductionPrompt.id !== prompt?.id) {
           // If yes, show the confirmation dialog
           setShowProductionConfirmDialog(true);
       } else {
           // Otherwise (no existing or editing the existing one), just set the state directly
           setIsProduction(true);
       }
    } else {
        // If unchecking, always allow setting state directly
        setIsProduction(false);
    }
  };

  // Re-introduce the confirmation handler
  const confirmProductionChange = () => {
    setIsProduction(true); // Set the state
    setShowProductionConfirmDialog(false); // Close the dialog
    // The actual backend update happens in handleSave
  };
  // --- End MODIFICATION ---

  // --- NEW: Handler for saving the prompt ---
  const handleSave = async () => {
    console.log("Save button clicked!");

    // --- MODIFIED: Differentiate between Create (POST) and Update (PUT) ---
    const isUpdating = !!prompt;
    const promptId = prompt?.id; // Get ID if updating
    const method = isUpdating ? "PUT" : "POST";
    const url = isUpdating
      ? `http://localhost:8000/api/v1/prompts/${promptId}`
      : "http://localhost:8000/api/v1/prompts/";
    // --- End MODIFICATION ---

    const promptData = {
      name: name,
      description: description,
      sections: sections,
      tags: selectedTags,
      project: selectedProject || null,
      language: selectedLanguage || null,
      isProduction: isProduction,
      version: version,
    };

    console.log(`Attempting to ${method} prompt data to ${url}:`, promptData);

    try {
      const response = await fetch(url, {
        method: method, // Use dynamic method
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(promptData),
      });

      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
        } catch (e) { /* Ignore JSON parsing error */ }
        console.error("Failed to save prompt:", errorDetail);
        toast.error(`Error saving prompt: ${errorDetail}`);
        return;
      }

      const savedPrompt: Prompt = await response.json();
      console.log("Prompt saved successfully:", savedPrompt);
      toast.success("Prompt saved successfully!");

      // --- MODIFIED: Update local state after save/update --- M
      // Update the version state locally to reflect backend change
      if (savedPrompt.version) {
        setVersion(savedPrompt.version);
      }
      // If we are updating (not creating), potentially update other states too?
      // For now, just version as it's auto-incremented.
      // --- End MODIFICATION ---

      // Call the success callback if provided (triggers library refresh)
      if (onSaveSuccess) {
        onSaveSuccess();
      }

    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error(`An unexpected error occurred: ${error}`);
    }
  };
  // --- End NEW handler ---

  // --- History Handlers --- M
  const fetchHistory = async () => {
    if (!prompt?.id) return; // Need a prompt ID

    setIsLoadingHistory(true);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/prompts/${prompt.id}/history`);
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }
      const data = await response.json();
      // TODO: Validate data against PromptHistory type from backend
      setPromptHistory(data as PromptHistory[]);
      setShowHistoryDialog(true); // Open dialog only after successful fetch
    } catch (error) {
      console.error("Error fetching prompt history:", error);
      toast.error(`Failed to load history: ${error instanceof Error ? error.message : error}`);
      setShowHistoryDialog(false); // Ensure dialog is closed on error
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleRestore = async (historyId: string) => {
    if (!prompt?.id) return;

    console.log(`Restoring prompt ${prompt.id} from history ${historyId}`);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/prompts/${prompt.id}/restore/${historyId}`, {
        method: "POST",
      });

      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
        } catch (e) { /* Ignore JSON parsing error */ }
        throw new Error(errorDetail);
      }

      const restoredPrompt: Prompt = await response.json();
      console.log("Prompt restored successfully:", restoredPrompt);
      toast.success("Prompt restored successfully!");

      // --- Update Editor State Directly --- M
      setName(restoredPrompt.name || "");
      setDescription(restoredPrompt.description || "");
      setSections(restoredPrompt.sections || []);
      setSelectedTags(restoredPrompt.tags || []);
      setSelectedProject(restoredPrompt.project);
      setSelectedLanguage(restoredPrompt.language);
      setIsProduction(restoredPrompt.isProduction || false);
      setVersion(restoredPrompt.version || "1.0");
      // --- End State Update ---

      // Close history dialog and trigger library refresh (still useful for library view)
      setShowHistoryDialog(false);
      if (onSaveSuccess) {
        onSaveSuccess();
      }

    } catch (error) {
        console.error("Error restoring prompt:", error);
        toast.error(`Failed to restore prompt: ${error instanceof Error ? error.message : error}`);
    }
  };
  // --- End History Handlers ---

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          {prompt ? `Editing: ${prompt.name}` : "Create New Prompt"}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          <div className="flex items-center border rounded-md px-2 py-1 h-9">
            <span className="text-sm text-muted-foreground mr-1">Version:</span>
            <span className="text-sm font-medium">{version}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            disabled={!prompt || isLoadingHistory}
          >
            <History className="mr-2 h-4 w-4" />
            {isLoadingHistory ? "Loading..." : "View History"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Prompt Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter prompt name" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a short description"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project">Project</Label>
            <Select
              value={selectedProject ?? SELECT_PLACEHOLDER_VALUE}
              onValueChange={(value) => setSelectedProject(value === SELECT_PLACEHOLDER_VALUE ? undefined : value)}
            >
              <SelectTrigger id="project">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_PLACEHOLDER_VALUE}>-- None --</SelectItem>
                {availableProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="language">Language</Label>
            <Select
              value={selectedLanguage ?? SELECT_PLACEHOLDER_VALUE}
              onValueChange={(value) => setSelectedLanguage(value === SELECT_PLACEHOLDER_VALUE ? undefined : value)}
            >
              <SelectTrigger id="language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_PLACEHOLDER_VALUE}>-- None --</SelectItem>
                {availableLanguages.map((language) => (
                  language.id !== 'all' && (
                    <SelectItem key={language.id} value={language.id}>
                      {language.name}
                    </SelectItem>
                  )
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {showPreview && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Complete Prompt Preview</CardTitle>
              <CardDescription>This is how your assembled prompt will look</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-md">
                <pre className="whitespace-pre-wrap font-mono text-sm overflow-auto max-h-[400px]">
                  {assembleCompletePrompt()}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>Prompt Sections</Label>
            <div className="flex gap-2">
              <Dialog open={showInsertSectionDialog} onOpenChange={setShowInsertSectionDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Bookmark className="mr-2 h-4 w-4" />
                    Insert Saved Section
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Insert Saved Section</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4 max-h-[400px] overflow-y-auto">
                    {mockSavedSections.map((section) => (
                      <div
                        key={section.id}
                        className="cursor-pointer rounded-lg border p-4 hover:bg-muted"
                        onClick={() => handleInsertSavedSection(section)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{section.name}</h4>
                          <Badge>{section.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono line-clamp-2">{section.content}</p>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Code className="mr-2 h-4 w-4" />
                    Use Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select a Template</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="cursor-pointer rounded-lg border p-4 hover:bg-muted"
                        onClick={() => {
                          handleTemplateSelect(template)
                        }}
                      >
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" onClick={handleAddSection}>
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {sections.map((section, index) => (
              <Card key={section.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <Select
                        value={section.type}
                        onValueChange={(value) => handleSectionTypeChange(section.id, value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Section type" />
                        </SelectTrigger>
                        <SelectContent>
                          {sectionTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {section.type === "custom" && (
                        <Input
                          value={section.name}
                          onChange={(e) => handleSectionNameChange(section.id, e.target.value)}
                          placeholder="Section name"
                          className="flex-1"
                        />
                      )}
                      {section.type !== "custom" && <CardTitle className="text-base">{section.name}</CardTitle>}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveSection(section.id, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveSection(section.id, "down")}
                        disabled={index === sections.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleSaveSection(section)}>
                        <BookmarkPlus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSection(section.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={section.content}
                    onChange={(e) => handleSectionContentChange(section.id, e.target.value)}
                    placeholder={`Enter ${section.name.toLowerCase()} here...`}
                    className="font-mono min-h-[120px]"
                  />
                </CardContent>
                <CardFooter className="flex justify-end pt-0">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Code className="mr-2 h-4 w-4" />
                        Insert Snippet
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Insert Snippet</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        {snippets.map((snippet) => (
                          <div
                            key={snippet.id}
                            className="cursor-pointer rounded-lg border p-4 hover:bg-muted"
                            onClick={() => {
                              handleSnippetInsert(snippet, section.id)
                            }}
                          >
                            <h4 className="font-medium">{snippet.name}</h4>
                            <p className="text-sm text-muted-foreground font-mono">{snippet.text}</p>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="is-production"
            checked={isProduction}
            onCheckedChange={handleProductionChange}
          />
          <label
            htmlFor="is-production"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Mark as Production
          </label>
          {isLoadingProductionCheck && <span className="text-sm text-muted-foreground ml-2">(Checking...)</span>}
          {!isLoadingProductionCheck && currentProductionPrompt && currentProductionPrompt.id !== prompt?.id && (
            <span className="text-sm text-muted-foreground ml-2">
              Current production prompt: <span className="font-medium">{currentProductionPrompt.name}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
        <Button variant="outline">Save as New Version</Button>
        <Button variant="outline">
          <GitBranch className="mr-2 h-4 w-4" />
          Create Branch
        </Button>
      </div>

      <Dialog open={showSaveSectionDialog} onOpenChange={setShowSaveSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Section</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="section-name">Section Name</Label>
              <Input
                id="section-name"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Enter a name for this section"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveSectionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSaveSection}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProductionConfirmDialog} onOpenChange={setShowProductionConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Production Prompt?</DialogTitle>
            <DialogDescription>
              There is already a production prompt for the selected project and language:
              <span className="font-semibold block mt-2">{currentProductionPrompt?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center p-4 border rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              <div className="text-sm">
                Continuing will replace the existing production prompt.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductionConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmProductionChange}>Confirm Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- History Dialog --- M */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-[60%]"> {/* Make dialog wider */} 
          <DialogHeader>
            <DialogTitle>Prompt History for: {prompt?.name}</DialogTitle>
            <DialogDescription>
              Select a previous version to view its details or restore it.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh] w-full rounded-md border p-4">
            {promptHistory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Saved At</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promptHistory.map((historyItem) => {
                    // --- Add Log --- M
                    console.log("History Dialog: Rendering row for history item:", historyItem);
                    // --- End Log ---
                    return (
                      <TableRow key={historyItem.id ?? Math.random()}> {/* Use random key if id is missing to avoid warning, but ID *should* exist */}
                        <TableCell>{new Date(historyItem.saved_at).toLocaleString()}</TableCell>
                        <TableCell>v{historyItem.version}</TableCell>
                        <TableCell className="truncate max-w-xs">{historyItem.description || "-"}</TableCell>
                        <TableCell>
                          <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleRestore(historyItem.id)} // Pass the ID here
                           >
                             Restore
                           </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground">No history found for this prompt.</p>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* --- End History Dialog -- */}

    </div>
  )
}
