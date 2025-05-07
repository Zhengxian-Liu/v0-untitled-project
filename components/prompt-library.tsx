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
  { id: "all", name: "所有语言" },
  { id: "en", name: "英语" },
  { id: "ja", name: "日语" },
  { id: "ko", name: "韩语" },
  { id: "zh", name: "中文" },
  { id: "fr", name: "法语" },
  { id: "de", name: "德语" },
  { id: "es", name: "西班牙语" },
  { id: "it", name: "意大利语" },
  { id: "ru", name: "俄语" },
  { id: "pt", name: "葡萄牙语" },
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
          throw new Error("从API接收到的数据格式无效")
        }
      } catch (err) {
        console.error("获取提示失败:", err)
        setError(err instanceof Error ? err.message : "发生未知错误")
      } finally {
        setIsLoading(false)
      }
    }

  useEffect(() => {
    fetchPrompts()
  }, [])

  const projects = [
    { id: "all", name: "所有项目" },
    { id: "genshin", name: "原神" },
    { id: "honkai", name: "崩坏：星穹铁道" },
    { id: "zenless", name: "绝区零" },
  ]

  const handleDeletePrompt = async (promptId: string) => {
    try {
      await apiClient(`/prompts/${promptId}`, { method: 'DELETE' })
      toast({
        title: "提示已删除",
        description: `提示版本 ${promptId} 已标记为删除。`,
      })
      fetchPrompts()
    } catch (err) {
      console.error("删除提示失败:", err)
      toast({
        title: "删除提示时出错",
        description: err instanceof Error ? err.message : "发生未知错误",
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

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="show-production"
            checked={showProductionOnly}
            onChange={(e) => setShowProductionOnly(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="show-production" className="text-sm font-medium">
            仅显示生产版本
          </label>
        </div>

        <Input
          placeholder="搜索提示..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading && <p>正在加载提示...</p>}
      {error && <p className="text-red-500">加载提示时出错: {error}</p>}

      {!isLoading && !error && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>标签</TableHead>
                <TableHead>项目</TableHead>
                <TableHead>版本</TableHead>
                <TableHead>生产</TableHead>
                <TableHead>最后修改时间</TableHead>
                <TableHead>操作</TableHead>
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
                      <TableCell>{prompt.version ? `v${prompt.version}` : "不适用"}</TableCell>
                      <TableCell>{prompt.isProduction && <CheckCircle2 className="h-5 w-5 text-green-500" />}</TableCell>
                      <TableCell>{prompt.updated_at ? new Date(prompt.updated_at).toLocaleString() : "不适用"}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="删除提示版本"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>您确定吗？</AlertDialogTitle>
                              <AlertDialogDescription>
                                此操作会将提示 
                                <code className="mx-1 font-mono bg-muted px-1 rounded">{prompt.name}</code> 的版本 
                                <code className="mx-1 font-mono bg-muted px-1 rounded">{prompt.version}</code> 标记为已删除。 
                                它将被隐藏但不会被永久移除（软删除）。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePrompt(prompt.id)}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              >
                                删除
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
                        未找到提示。
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
