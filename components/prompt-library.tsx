"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2 } from "lucide-react"
import { Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import type { Prompt, EvaluationSessionSummary } from "@/types"
import { apiClient } from "@/lib/apiClient"

const availableLanguages = [
  { id: "all", name: "All Languages" },
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

interface PromptLibraryProps {
  onPromptSelect?: (prompt: Prompt) => void;
  currentLanguage: string;
}

export function PromptLibrary({ onPromptSelect, currentLanguage }: PromptLibraryProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProject, setSelectedProject] = useState("all")
  const [showProductionOnly, setShowProductionOnly] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchPrompts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient<Prompt[]>('/prompts/')
      console.log("PromptLibrary: Fetched data:", data)
      if (Array.isArray(data)) {
        setPrompts(data)
      } else {
        throw new Error("Invalid data format received from API")
      }
    } catch (err) {
      console.error("Failed to fetch prompts:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPrompts()
  }, [])

  const projects = [
    { id: "all", name: "All Projects" },
    { id: "genshin", name: "Genshin" },
    { id: "honkai", name: "Honkai: Starrail" },
    { id: "zenless", name: "Zenless Zone Zero" },
  ]

  const handleDeletePrompt = async (promptId: string) => {
    try {
      await apiClient(`/prompts/${promptId}`, { method: 'DELETE' })
      toast({
        title: "Prompt Deleted",
        description: `Prompt version ${promptId} marked as deleted.`,
      })
      fetchPrompts()
    } catch (err) {
      console.error("Failed to delete prompt:", err)
      toast({
        title: "Error Deleting Prompt",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive",
      })
    }
  }

  const filteredPrompts = prompts.filter(
    (prompt) =>
      prompt.language === currentLanguage &&
      (prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (prompt.description && prompt.description.toLowerCase().includes(searchQuery.toLowerCase()))) &&
      (selectedProject === "all" || prompt.project === selectedProject) &&
      (!showProductionOnly || prompt.isProduction === true)
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 mb-4">
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
          <input
            type="checkbox"
            id="show-production"
            checked={showProductionOnly}
            onChange={(e) => setShowProductionOnly(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="show-production" className="text-sm font-medium">
            Show Production Only
          </label>
        </div>

        <Input
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading && <p>Loading prompts...</p>}
      {error && <p className="text-red-500">Error loading prompts: {error}</p>}

      {!isLoading && !error && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Production</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrompts.length > 0 ? (
                filteredPrompts.map((prompt) => {
                  console.log("PromptLibrary: Rendering TableRow with key:", prompt.id, "Prompt object:", prompt);
                  return (
                    <TableRow
                      key={prompt.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onPromptSelect && onPromptSelect(prompt)}
                    >
                      <TableCell className="font-medium">{prompt.name}</TableCell>
                      <TableCell>{prompt.description}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {prompt.tags?.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {prompt.project && (
                          <Badge variant="secondary">
                            {projects.find((p) => p.id === prompt.project)?.name || prompt.project}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{prompt.version ? `v${prompt.version}` : "N/A"}</TableCell>
                      <TableCell>{prompt.isProduction && <CheckCircle2 className="h-5 w-5 text-green-500" />}</TableCell>
                      <TableCell>{prompt.updated_at ? new Date(prompt.updated_at).toLocaleString() : "N/A"}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Delete prompt version"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action will mark prompt version 
                                <code className="mx-1 font-mono bg-muted px-1 rounded">{prompt.version}</code> of 
                                <code className="mx-1 font-mono bg-muted px-1 rounded">{prompt.name}</code> as deleted. 
                                It will be hidden but not permanently removed (soft delete).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePrompt(prompt.id)}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                    <TableCell colSpan={8} className="text-center">
                        No prompts found.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
