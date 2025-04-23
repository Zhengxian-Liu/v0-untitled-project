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
} from "lucide-react"
import type { Prompt, PromptSection, SavedSection, ProductionPrompt } from "@/types"

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

export function PromptEditor({ prompt }: { prompt: Prompt | null }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedProject, setSelectedProject] = useState("genshin")
  const [selectedLanguage, setSelectedLanguage] = useState("en")
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

  // Add state for production prompt confirmation
  const [showProductionConfirmDialog, setShowProductionConfirmDialog] = useState(false)
  const [currentProductionPrompt, setCurrentProductionPrompt] = useState<ProductionPrompt | null>(null)

  useEffect(() => {
    if (prompt) {
      setName(prompt.name)
      setDescription(prompt.description)
      setIsProduction(prompt.isProduction || false)
      setSelectedTags(prompt.tags)
      setVersion(prompt.version)
      setSelectedProject(prompt.project || "genshin")
      setSelectedLanguage(prompt.language || "en")

      // If the prompt has sections, use them; otherwise, convert the text to a single section
      if (prompt.sections && prompt.sections.length > 0) {
        setSections(prompt.sections)
      } else {
        setSections([{ id: "1", type: "instructions", name: "Instructions", content: prompt.text }])
      }
    } else {
      // Reset form for new prompt
      setName("")
      setDescription("")
      setIsProduction(false)
      setSelectedTags([])
      setSelectedProject("genshin")
      setSelectedLanguage("en")
      setVersion("1.0")
      setSections([
        { id: "1", type: "role", name: "Role Definition", content: "" },
        { id: "2", type: "context", name: "Context", content: "" },
        { id: "3", type: "instructions", name: "Instructions", content: "" },
      ])
    }
  }, [prompt])

  // Check for existing production prompt when project or language changes
  useEffect(() => {
    const existingProductionPrompt = mockProductionPrompts.find(
      (p) => p.project === selectedProject && p.language === selectedLanguage,
    )

    setCurrentProductionPrompt(existingProductionPrompt)
  }, [selectedProject, selectedLanguage])

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

  // Handle production status change
  const handleProductionChange = (checked: boolean) => {
    if (checked && currentProductionPrompt) {
      // If there's already a production prompt, show confirmation dialog
      setShowProductionConfirmDialog(true)
    } else {
      // Otherwise, just set the status
      setIsProduction(checked)
    }
  }

  // Confirm changing production status
  const confirmProductionChange = () => {
    setIsProduction(true)
    setShowProductionConfirmDialog(false)

    // In a real app, this would update the database to mark the current prompt as production
    // and remove production status from the previous production prompt
  }

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
          <span className="text-sm text-muted-foreground">Version: v{version}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>v1.0 (Initial)</DropdownMenuItem>
              <DropdownMenuItem>v1.1 (2023-04-10)</DropdownMenuItem>
              <DropdownMenuItem>v1.2 (Latest)</DropdownMenuItem>
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
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger id="project">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
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
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger id="language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map((language) => (
                  <SelectItem key={language.id} value={language.id}>
                    {language.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

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
            onCheckedChange={(checked) => handleProductionChange(!!checked)}
          />
          <label
            htmlFor="is-production"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Mark as Production
          </label>

          {currentProductionPrompt && (
            <span className="text-sm text-muted-foreground ml-2">
              Current production prompt: <span className="font-medium">{currentProductionPrompt.promptName}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
        <Button variant="outline">Save as New Version</Button>
        <Button variant="outline">
          <GitBranch className="mr-2 h-4 w-4" />
          Create Branch
        </Button>
      </div>

      {/* Dialog for saving a section */}
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

      {/* Dialog for production prompt confirmation */}
      <Dialog open={showProductionConfirmDialog} onOpenChange={setShowProductionConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Production Prompt</DialogTitle>
            <DialogDescription>
              There is already a production prompt for{" "}
              {selectedProject && availableProjects.find((p) => p.id === selectedProject)?.name} in{" "}
              {selectedLanguage && availableLanguages.find((l) => l.id === selectedLanguage)?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center p-4 border rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              <div className="text-sm">
                Changing the production prompt will replace{" "}
                <span className="font-semibold">{currentProductionPrompt?.promptName}</span> as the production prompt
                for this project and language.
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
    </div>
  )
}
