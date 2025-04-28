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
  Loader2,
  Check,
} from "lucide-react"
import type { Prompt, PromptSection, SavedSection, ProductionPrompt } from "@/types"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiClient } from "@/lib/apiClient"

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

// --- Update Props Type --- M
interface PromptEditorProps {
  prompt: Prompt | null;
  onSaveSuccess?: () => void;
  currentLanguage: string; // Add currentLanguage prop
}

// --- Constant for Select placeholder value --- M
const SELECT_PLACEHOLDER_VALUE = "--none--";

// Use the updated Props type
export function PromptEditor({ prompt, onSaveSuccess, currentLanguage }: PromptEditorProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined)
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

  // --- Restore state for production check --- M
  const [currentProductionPrompt, setCurrentProductionPrompt] = useState<Prompt | null>(null)
  const [isLoadingProductionCheck, setIsLoadingProductionCheck] = useState(false)
  const [showProductionConfirmDialog, setShowProductionConfirmDialog] = useState(false)
  // --- End Restore ---

  // --- Versioning State --- M
  const [versionHistory, setVersionHistory] = useState<Prompt[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [currentlyLoadedVersionId, setCurrentlyLoadedVersionId] = useState<string | null>(null)
  // --- End Versioning State ---

  // --- Function to fetch version history --- M
  const fetchVersionHistory = async (basePromptId: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const url = `/prompts/base/${basePromptId}/versions`;
      const historyData = await apiClient<Prompt[]>(url);
      // Sort history newest first (optional, backend might already do this)
      historyData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setVersionHistory(historyData);
      console.log("Fetched version history: ", historyData);
    } catch (err) {
      console.error("Error fetching version history:", err);
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setHistoryError(errorMsg);
      toast.error(`Failed to load version history: ${errorMsg}`);
      setVersionHistory([]); // Clear history on error
    } finally {
      setIsLoadingHistory(false);
    }
  };
  // --- End fetch function ---

  useEffect(() => {
    // Reset version history when prompt changes
    setVersionHistory([]);
    setIsLoadingHistory(false);
    setHistoryError(null);

    if (prompt) {
      // Load state from the passed prompt object
      setName(prompt.name || "")
      setDescription(prompt.description || "")
      setSections(prompt.sections && prompt.sections.length > 0 ? prompt.sections : [])
      setSelectedTags(prompt.tags || [])
      setSelectedProject(prompt.project)
      setIsProduction(prompt.isProduction || false)
      setVersion(prompt.version || "1.0")
      // --- Set currently loaded ID and fetch history --- M
      setCurrentlyLoadedVersionId(prompt.id);
      if (prompt.base_prompt_id) {
         fetchVersionHistory(prompt.base_prompt_id);
      } else {
         // This case shouldn't happen if prompts are created correctly
         console.warn("Prompt loaded in editor is missing base_prompt_id! Cannot fetch history.");
         setHistoryError("Cannot fetch history: Prompt base ID missing.");
      }
      // --- End fetch --- M
    } else {
      // Reset form for new prompt (set default sections)
      setName("")
      setDescription("")
      setIsProduction(false)
      setSelectedTags([])
      setSelectedProject(undefined)
      setVersion("1.0")
      setSections([
        { id: "1", type: "role", name: "Role Definition", content: "" },
        { id: "2", type: "context", name: "Context", content: "" },
        { id: "3", type: "instructions", name: "Instructions", content: "" },
      ])
      // --- Clear loaded ID for new prompt --- M
      setCurrentlyLoadedVersionId(null);
      // --- End Clear ---
    }
  }, [prompt])

  // Effect to check production status
  useEffect(() => {
    const fetchCurrentProductionPrompt = async () => {
      if (selectedProject && currentLanguage) {
        try {
          // --- Use apiClient --- M
          const url = `/prompts/production/?project=${encodeURIComponent(selectedProject)}&language=${encodeURIComponent(currentLanguage)}`;
          const data = await apiClient<Prompt>(url);
          // --- End Use --- M
          setCurrentProductionPrompt(data);
        } catch (error: any) {
          if (error.message.includes("404")) { // Check error message for 404
            setCurrentProductionPrompt(null);
          } else {
            console.error("Error fetching production prompt status:", error);
            setCurrentProductionPrompt(null);
          }
        } finally { setIsLoadingProductionCheck(false); }
      } else { setCurrentProductionPrompt(null); }
    };
    fetchCurrentProductionPrompt();
  }, [selectedProject, currentLanguage]);

  // --- Version Select Handler --- M
  const handleVersionSelect = (selectedPrompt: Prompt) => {
    console.log("Loading version:", selectedPrompt.id, selectedPrompt.version);

    // Update all relevant form states with the selected version's data
    setName(selectedPrompt.name || "");
    setDescription(selectedPrompt.description || "");
    setSections(selectedPrompt.sections && selectedPrompt.sections.length > 0 ? selectedPrompt.sections : []);
    setSelectedTags(selectedPrompt.tags || []);
    setSelectedProject(selectedPrompt.project);
    setIsProduction(selectedPrompt.isProduction || false);
    setVersion(selectedPrompt.version || "?.?"); // Update displayed version

    // Update the tracker for which version is currently loaded
    setCurrentlyLoadedVersionId(selectedPrompt.id);

    toast.info(`Loaded version ${selectedPrompt.version}`);
  };
  // --- End Version Select Handler ---

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

  // --- Restore handleProductionChange with Dialog logic --- M
  const handleProductionChange = (checked: boolean) => {
    if (checked) {
       // Check if a *different* production prompt exists for this project (and fixed language)
       if (currentProductionPrompt && currentProductionPrompt.id !== prompt?.id) {
           setShowProductionConfirmDialog(true); // Show dialog
       } else {
           setIsProduction(true); // Set state directly
       }
    } else {
        setIsProduction(false); // Always allow unchecking
    }
  };

  // Restore the confirmation handler
  const confirmProductionChange = () => {
    setIsProduction(true);
    setShowProductionConfirmDialog(false);
  };
  // --- End Restore ---

  const handleSave = async () => {
    console.log("Save button clicked!");

    // --- MODIFIED: Handle both Create (POST) and Save New Version (PUT) --- M
    const isCreatingNew = !prompt; // True if prompt prop is null
    const method = isCreatingNew ? "POST" : "PUT";
    const endpoint = isCreatingNew
      ? `/prompts/`
      : `/prompts/${currentlyLoadedVersionId}`;

    // Add a check for PUT if the loaded ID is missing (shouldn't happen)
    if (method === "PUT" && !currentlyLoadedVersionId) {
        toast.error("Cannot save: No base version loaded in the editor.");
        console.error("Save aborted: currentlyLoadedVersionId is null for PUT request.");
        return;
    }

    // Payload preparation - needs slight adjustment based on method
    const basePayload = {
      name: name,
      description: description,
      sections: sections,
      tags: selectedTags,
      project: selectedProject || null,
      language: currentLanguage,
      isProduction: isProduction,
      // version: version, // Don't send version - backend handles it
    };

    // For PUT, the payload matches PromptUpdate (all optional)
    // For POST, the payload matches PromptCreate (all required from PromptBase)
    // Our basePayload includes everything needed for PromptCreate implicitly.
    const promptData = basePayload;

    // --- End MODIFICATION ---

    console.log(`Attempting to ${method} prompt data to ${endpoint}:`, promptData);

    try {
      // --- Use apiClient --- M
      const savedPromptVersion = await apiClient<Prompt>(endpoint, {
        method: method,
        body: JSON.stringify(promptData),
        // apiClient sets Content-Type header automatically for JSON body
      });
      // --- End Use --- M
      const successMessage = isCreatingNew
        ? `Prompt created successfully as version ${savedPromptVersion.version}!`
        : `Prompt saved successfully as new version ${savedPromptVersion.version}!`;
      toast.success(successMessage);

      // Update local state
      setVersion(savedPromptVersion.version || "?.?");
      // Update the currently loaded ID to the newly saved version's ID
      setCurrentlyLoadedVersionId(savedPromptVersion.id);

      // Refetch history to include the new version
      if (savedPromptVersion.base_prompt_id) {
          fetchVersionHistory(savedPromptVersion.base_prompt_id);
      }

      if (onSaveSuccess) {
        onSaveSuccess();
      }

    } catch (error) {
      console.error(`Error ${isCreatingNew ? 'creating' : 'saving'} prompt:`, error);
      toast.error(`Failed to ${isCreatingNew ? 'create' : 'save'} prompt: ${error instanceof Error ? error.message : error}`);
    }
  };

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                Version: {version}
                {isLoadingHistory ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-1.5 text-sm font-semibold">Version History</div>
              {historyError && (
                 <div className="px-2 py-1.5 text-sm text-destructive">{historyError}</div>
              )}
              {!isLoadingHistory && !historyError && versionHistory.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">(No history found)</div>
              )}
              {!isLoadingHistory && !historyError && versionHistory.map((histPrompt) => (
                <DropdownMenuItem
                  key={histPrompt.id}
                  onSelect={() => handleVersionSelect(histPrompt)}
                  className="cursor-pointer"
                  disabled={histPrompt.id === currentlyLoadedVersionId}
                >
                  <span className="mr-auto">
                    Version {histPrompt.version}
                    {histPrompt.is_latest && <Badge variant="secondary" className="ml-2">Latest</Badge>}
                    {histPrompt.isProduction && <Badge variant="destructive" className="ml-2">Prod</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(histPrompt.created_at).toLocaleDateString()}
                  </span>
                  {histPrompt.id === currentlyLoadedVersionId && <Check className="ml-2 h-4 w-4"/>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* --- Restore Production Confirm Dialog --- M */}
      <Dialog open={showProductionConfirmDialog} onOpenChange={setShowProductionConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Production Prompt?</DialogTitle>
            <DialogDescription>
              There is already a production prompt ({currentProductionPrompt?.name}) for the selected project and language ({currentLanguage}).
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
      {/* --- End Restore --- */}

    </div>
  )
}

