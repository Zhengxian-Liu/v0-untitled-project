"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Trash2 } from "lucide-react"
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useToast } from "@/components/ui/use-toast"
import type { Prompt, BasePromptSummary } from "@/types"
import { apiClient } from "@/lib/apiClient"
import { availableLanguages as baseAvailableLanguages, availableProjects as baseAvailableProjects } from "@/lib/constants"

const availableLanguages = [
  { id: "all", name: "所有语言" },
  ...baseAvailableLanguages,
]

interface PromptLibraryProps {
  onPromptSelect?: (prompt: Prompt) => void;
  currentLanguage: string;
}

const projects = [
  { id: "all", name: "所有项目" },
  ...baseAvailableProjects,
]

export function PromptLibrary({ onPromptSelect, currentLanguage }: PromptLibraryProps) {
  const [basePrompts, setBasePrompts] = useState<BasePromptSummary[]>([])
  const [fetchedVersions, setFetchedVersions] = useState<Record<string, Prompt[]>>({})
  const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({})

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProject, setSelectedProject] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchBasePrompts = async () => {
    setIsLoading(true)
    setError(null)
    setFetchedVersions({})
    setLoadingVersions({})
    try {
      const data = await apiClient<BasePromptSummary[]>('/prompts/base-summaries/')
      console.log("PromptLibrary: Fetched base summaries:", data)
      if (Array.isArray(data)) {
        const languageFiltered = data.filter(p => p.language === currentLanguage);
        setBasePrompts(languageFiltered)
      } else {
        throw new Error("从API接收到的基础提示数据格式无效")
      }
    } catch (err) {
      console.error("获取基础提示列表失败:", err)
      setError(err instanceof Error ? err.message : "发生未知错误")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBasePrompts()
  }, [currentLanguage])

  const handleFetchVersions = async (basePromptId: string) => {
    if (fetchedVersions[basePromptId] || loadingVersions[basePromptId]) {
      return
    }

    setLoadingVersions(prev => ({ ...prev, [basePromptId]: true }))
    try {
      const versions = await apiClient<Prompt[]>(`/prompts/base/${basePromptId}/versions`)
      console.log(`PromptLibrary: Fetched versions for ${basePromptId}:`, versions)
      if (Array.isArray(versions)) {
        setFetchedVersions(prev => ({ ...prev, [basePromptId]: versions }))
      } else {
        throw new Error("获取提示版本的数据格式无效")
      }
    } catch (err) {
      console.error(`获取提示 ${basePromptId} 的版本失败:`, err)
      toast({
        title: "获取版本时出错",
        description: `无法加载提示 ${basePromptId} 的版本。`, 
        variant: "destructive",
      })
      setFetchedVersions(prev => ({ ...prev, [basePromptId]: [] }))
    } finally {
      setLoadingVersions(prev => ({ ...prev, [basePromptId]: false }))
    }
  }

  const filteredBasePrompts = basePrompts.filter(
    (prompt) =>
      (prompt.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (selectedProject === "all" || prompt.project === selectedProject)
  )

  const handleDeletePromptVersion = async (versionId: string, basePromptId: string) => {
    try {
      await apiClient(`/prompts/${versionId}`, { method: 'DELETE' })
      toast({
        title: "提示版本已删除",
        description: `提示版本 ${versionId} 已标记为删除。`,
      })
      if (fetchedVersions[basePromptId]) {
        setFetchedVersions(prev => ({ 
            ...prev, 
            [basePromptId]: prev[basePromptId]?.filter(v => v.id !== versionId) ?? []
        }));
      }
    } catch (err) {
      console.error("删除提示版本失败:", err)
      toast({
        title: "删除提示版本时出错",
        description: err instanceof Error ? err.message : "发生未知错误",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="搜索提示名称..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading && <p>正在加载提示列表...</p>}
      {error && <p className="text-red-500">加载提示列表时出错: {error}</p>}

      {!isLoading && !error && (
        <Accordion type="single" collapsible className="w-full">
          {filteredBasePrompts.length > 0 ? (
            filteredBasePrompts.map((basePrompt) => (
              <AccordionItem value={basePrompt.base_prompt_id} key={basePrompt.base_prompt_id}>
                <AccordionTrigger 
                  onClick={() => handleFetchVersions(basePrompt.base_prompt_id)} 
                  className="hover:bg-muted/50 px-4"
                >
                  <div className="flex justify-between w-full items-center pr-4">
                    <span className="font-medium text-left flex-1 mr-4">{basePrompt.name}</span>
                    <div className="flex gap-2 items-center text-sm text-muted-foreground">
                      {basePrompt.project && (
                          <Badge variant="secondary">
                            {projects.find((p) => p.id === basePrompt.project)?.name || basePrompt.project}
                          </Badge>
                      )}
                      <span>最后更新: {new Date(basePrompt.latest_updated_at).toLocaleString()}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-0">
                  {loadingVersions[basePrompt.base_prompt_id] && <p className="p-4 text-muted-foreground">正在加载版本...</p>}
                  {!loadingVersions[basePrompt.base_prompt_id] && fetchedVersions[basePrompt.base_prompt_id] && (
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">版本</TableHead>
                            <TableHead className="w-[100px]">得分</TableHead>
                            <TableHead className="w-[100px]">生产</TableHead>
                            <TableHead>创建时间</TableHead>
                            <TableHead className="w-[80px]">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fetchedVersions[basePrompt.base_prompt_id].length > 0 ? (
                             fetchedVersions[basePrompt.base_prompt_id].map((version) => (
                              <TableRow 
                                key={version.id} 
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => onPromptSelect && onPromptSelect(version)}
                              >
                                <TableCell>{version.version ? `v${version.version}` : "N/A"}</TableCell>
                                <TableCell>
                                  {version.latest_score !== null && version.latest_score !== undefined 
                                    ? version.latest_score.toFixed(1) 
                                    : "N/A"}
                                </TableCell>
                                <TableCell>{version.isProduction && <CheckCircle2 className="h-5 w-5 text-green-500" />}</TableCell>
                                <TableCell>{new Date(version.created_at).toLocaleString()}</TableCell>
                                <TableCell>
                                   <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={(e) => e.stopPropagation()}
                                          aria-label="删除此版本"
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent onClick={(e) => e.stopPropagation()}> 
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>您确定吗？</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            此操作会将提示 
                                            <code className="mx-1 font-mono bg-muted px-1 rounded">{basePrompt.name}</code> 的版本 
                                            <code className="mx-1 font-mono bg-muted px-1 rounded">{version.version}</code> 标记为已删除。 
                                            它将被隐藏但不会被永久移除（软删除）。
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>取消</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeletePromptVersion(version.id, basePrompt.base_prompt_id)}
                                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                          >
                                            删除版本
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog> 
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    未找到此提示的版本。
                                </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))
          ) : (
             <div className="text-center p-10 text-muted-foreground">未找到符合条件的提示。</div>
          )}
        </Accordion>
      )}
    </div>
  )
}