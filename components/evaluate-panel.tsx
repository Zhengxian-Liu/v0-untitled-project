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
    name: "Technical Documentation Translation",
    version: "1.2",
  },
  {
    id: "2",
    name: "Marketing Content Translation",
    version: "2.1",
  },
  {
    id: "3",
    name: "Legal Document Translation",
    version: "1.0",
  },
  {
    id: "4",
    name: "Conversational AI Translation",
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
  { id: "1", name: "Standard Test Set 1" },
  { id: "2", name: "Technical Documentation Samples" },
  { id: "3", name: "Marketing Content Samples" },
  { id: "4", name: "Legal Document Samples" },
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
            <CardTitle>Step 1: Select Prompts</CardTitle>
            <CardDescription>Choose one or more prompts to evaluate</CardDescription>
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
            <CardTitle>Step 2: Select AI Model</CardTitle>
            <CardDescription>Choose the AI model to use for evaluation</CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select AI model" />
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
          <CardTitle>Step 3: Select Test Set</CardTitle>
          <CardDescription>Choose or provide text samples for evaluation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="test-set-type">Test Set Type</Label>
              <Select value={testSetType} onValueChange={setTestSetType}>
                <SelectTrigger id="test-set-type">
                  <SelectValue placeholder="Select test set type" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="standardized">Standardized Test Set</SelectItem>
                  <SelectItem value="upload">Upload New Set</SelectItem>
                  <SelectItem value="manual">Manual Input</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {testSetType === "standardized" && (
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select standardized test set" />
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
                <Label htmlFor="file-upload">Upload File</Label>
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">CSV or TXT file (max. 10MB)</p>
                    </div>
                    <input id="file-upload" type="file" className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {testSetType === "manual" && (
              <div className="grid w-full gap-1.5">
                <Label htmlFor="manual-input">Enter Text Samples</Label>
                <Textarea
                  id="manual-input"
                  placeholder="Enter one text sample per line"
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
          {isLoading ? "Running..." : "Run Evaluation"}
        </Button>
      </div>
    </div>
  )
}
