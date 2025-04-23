"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Prompt } from "@/types"

const mockPrompts: Prompt[] = [
  {
    id: "1",
    name: "Technical Documentation Translation",
    description: "Optimized for technical manuals and documentation",
    lastModified: "2023-04-15",
    tags: ["Technical", "Formal"],
    version: "1.2",
    isProduction: true,
    project: "genshin",
    language: "ja",
    text: "You are a technical translator specializing in [SOURCE_LANGUAGE] to [TARGET_LANGUAGE] translations. Translate the following technical documentation, maintaining all technical terminology accurately. Preserve formatting such as bullet points and numbered lists. If specific technical terms should not be translated, keep them in the original language and format them in italics.",
  },
  {
    id: "2",
    name: "Marketing Content Translation",
    description: "For creative and persuasive marketing materials",
    lastModified: "2023-04-10",
    tags: ["Marketing", "Casual"],
    version: "2.1",
    isProduction: true,
    project: "honkai",
    language: "fr",
    text: "You are a marketing translator specializing in adapting persuasive content from [SOURCE_LANGUAGE] to [TARGET_LANGUAGE]. Translate the following marketing content, maintaining the emotional impact and persuasive elements. Adapt cultural references as needed to resonate with the target audience. Preserve the tone, style, and brand voice of the original content.",
  },
  {
    id: "3",
    name: "Legal Document Translation",
    description: "For contracts and legal documents",
    lastModified: "2023-04-05",
    tags: ["Legal", "Formal"],
    version: "1.0",
    isProduction: true,
    project: "zenless",
    language: "es",
    text: "You are a legal translator specializing in [SOURCE_LANGUAGE] to [TARGET_LANGUAGE] translations. Translate the following legal document with precision, maintaining all legal terminology accurately. Preserve the formal structure and formatting of the document. If specific legal terms have established equivalents in the target language, use those equivalents consistently.",
  },
  {
    id: "4",
    name: "Conversational AI Translation",
    description: "For chatbot and conversational AI content",
    lastModified: "2023-04-01",
    tags: ["Conversational", "Casual"],
    version: "1.5",
    isProduction: false,
    project: "genshin",
    language: "en",
    text: "You are a translator specializing in conversational content from [SOURCE_LANGUAGE] to [TARGET_LANGUAGE]. Translate the following conversational exchanges, maintaining the natural flow and tone of a conversation. Adapt idioms and expressions to sound natural in the target language. Preserve the level of formality or informality present in the original text.",
  },
]

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

export function PromptLibrary({ onPromptSelect }: { onPromptSelect?: (prompt: Prompt) => void }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProject, setSelectedProject] = useState("all")
  const [selectedLanguage, setSelectedLanguage] = useState("all")
  const [showProductionOnly, setShowProductionOnly] = useState(false)

  const filteredPrompts = mockPrompts.filter(
    (prompt) =>
      (prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (selectedProject === "all" || prompt.project === selectedProject) &&
      (selectedLanguage === "all" || prompt.language === selectedLanguage) &&
      (!showProductionOnly || prompt.isProduction),
  )

  const projects = [
    { id: "all", name: "All Projects" },
    { id: "genshin", name: "Genshin" },
    { id: "honkai", name: "Honkai: Starrail" },
    { id: "zenless", name: "Zenless Zone Zero" },
  ]

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

        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
          <SelectTrigger className="w-[200px]">
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Last Modified</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Production</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPrompts.map((prompt) => (
              <TableRow
                key={prompt.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onPromptSelect && onPromptSelect(prompt)}
              >
                <TableCell className="font-medium">{prompt.name}</TableCell>
                <TableCell>{prompt.description}</TableCell>
                <TableCell>{prompt.lastModified}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {prompt.tags.map((tag) => (
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
                <TableCell>
                  {prompt.language && (
                    <Badge variant="outline">
                      {availableLanguages.find((l) => l.id === prompt.language)?.name || prompt.language}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>v{prompt.version}</TableCell>
                <TableCell>{prompt.isProduction && <CheckCircle2 className="h-5 w-5 text-green-500" />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
