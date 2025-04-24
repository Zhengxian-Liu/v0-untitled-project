"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Prompt, EvaluationSessionSummary } from "@/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

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

  useEffect(() => {
    const fetchPrompts = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const fetchUrl = `${API_BASE_URL}/prompts/`;
        console.log("PromptLibrary: Fetching from URL:", fetchUrl);
        const response = await fetch(fetchUrl);
        if (!response.ok) {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (e) { /* Ignore JSON parsing error */ }
          throw new Error(errorDetail);
        }
        const data = await response.json();
        setPrompts(data as Prompt[]);
      } catch (err) {
        console.error("Failed to fetch prompts:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrompts();
  }, []);

  const projects = [
    { id: "all", name: "All Projects" },
    { id: "genshin", name: "Genshin" },
    { id: "honkai", name: "Honkai: Starrail" },
    { id: "zenless", name: "Zenless Zone Zero" },
  ]

  const filteredPrompts = prompts.filter(
    (prompt) =>
      prompt.language === currentLanguage &&
      (prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (prompt.description && prompt.description.toLowerCase().includes(searchQuery.toLowerCase()))) &&
      (selectedProject === "all" || prompt.project === selectedProject) &&
      (!showProductionOnly || prompt.isProduction === true)
  );

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
