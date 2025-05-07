"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Upload } from "lucide-react"

const mockPrompts = [
  {
    id: "1",
    name: "技术文档翻译",
    version: "1.2",
  },
  {
    id: "2",
    name: "营销内容翻译",
    version: "2.1",
  },
  {
    id: "3",
    name: "法律文件翻译",
    version: "1.0",
  },
  {
    id: "4",
    name: "对话式 AI 翻译",
    version: "1.5",
  },
]

const mockModels = [
  { id: "1", name: "GPT-4" },
  { id: "2", name: "GPT-3.5 Turbo" },
  { id: "3", name: "Claude 2" },
  { id: "4", name: "PaLM 2" },
]

const mockTestSets = [
  { id: "1", name: "标准测试集 1" },
  { id: "2", name: "技术文档样本" },
  { id: "3", name: "营销内容样本" },
  { id: "4", name: "法律文件样本" },
]

export function EvaluatePanel({ onRunEvaluation }: { onRunEvaluation?: () => void }) {
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [testSetType, setTestSetType] = useState("standardized")
  const [manualInput, setManualInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handlePromptToggle = (promptId: string) => {
    if (selectedPrompts.includes(promptId)) {
      setSelectedPrompts(selectedPrompts.filter((id) => id !== promptId))
    } else {
      setSelectedPrompts([...selectedPrompts, promptId])
    }
  }

  const handleRunEvaluation = () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      if (onRunEvaluation) {
        onRunEvaluation()
      }
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>第 1 步：选择提示</CardTitle>
            <CardDescription>选择一个或多个提示进行评估</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockPrompts.map((prompt) => (
                <div key={prompt.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`prompt-${prompt.id}`}
                    checked={selectedPrompts.includes(prompt.id)}
                    onCheckedChange={() => handlePromptToggle(prompt.id)}
                  />
                  <label
                    htmlFor={`prompt-${prompt.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {prompt.name} (v{prompt.version})
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>第 2 步：选择 AI 模型</CardTitle>
            <CardDescription>选择用于评估的 AI 模型</CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="选择 AI 模型" />
              </SelectTrigger>
              <SelectContent>
                {mockModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>第 3 步：选择测试集</CardTitle>
          <CardDescription>选择或提供用于评估的文本样本</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="test-set-type">测试集类型</Label>
              <Select value={testSetType} onValueChange={setTestSetType}>
                <SelectTrigger id="test-set-type">
                  <SelectValue placeholder="选择测试集类型" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="standardized">标准测试集</SelectItem>
                  <SelectItem value="upload">上传新测试集</SelectItem>
                  <SelectItem value="manual">手动输入</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {testSetType === "standardized" && (
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择标准测试集" />
                </SelectTrigger>
                <SelectContent>
                  {mockTestSets.map((testSet) => (
                    <SelectItem key={testSet.id} value={testSet.id}>
                      {testSet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {testSetType === "upload" && (
              <div className="grid w-full gap-1.5">
                <Label htmlFor="file-upload">上传文件</Label>
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold">点击上传</span> 或拖放文件
                      </p>
                      <p className="text-xs text-muted-foreground">CSV 或 TXT 文件 (最大 10MB)</p>
                    </div>
                    <input id="file-upload" type="file" className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {testSetType === "manual" && (
              <div className="grid w-full gap-1.5">
                <Label htmlFor="manual-input">输入文本样本</Label>
                <Textarea
                  id="manual-input"
                  placeholder="每行输入一个文本样本"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="min-h-[150px]"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleRunEvaluation} disabled={selectedPrompts.length === 0 || !selectedModel || isLoading}>
          {isLoading ? "运行中..." : "运行评估"}
        </Button>
      </div>
    </div>
  )
}
