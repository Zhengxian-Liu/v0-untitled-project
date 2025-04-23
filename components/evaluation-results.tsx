"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, MessageSquare } from "lucide-react"

type ResultItem = {
  id: string
  sourceText: string
  referenceTranslation?: string
  outputs: {
    promptId: string
    promptName: string
    text: string
    score?: number
    comment?: string
  }[]
}

const mockResults: ResultItem[] = [
  {
    id: "1",
    sourceText: "The software update includes critical security patches and performance improvements.",
    referenceTranslation:
      "ソフトウェアアップデートには、重要なセキュリティパッチとパフォーマンスの向上が含まれています。",
    outputs: [
      {
        promptId: "1",
        promptName: "Technical Documentation Translation",
        text: "ソフトウェアアップデートには、重要なセキュリティパッチとパフォーマンスの向上が含まれています。",
        score: 5,
        comment: "Perfect technical translation",
      },
      {
        promptId: "2",
        promptName: "Marketing Content Translation",
        text: "ソフトウェアの更新には、重要なセキュリティ修正と性能向上が含まれています。",
        score: 4,
        comment: "Good but less precise terminology",
      },
    ],
  },
  {
    id: "2",
    sourceText: "Please restart your device after installation to apply all changes.",
    referenceTranslation: "インストール後、すべての変更を適用するためにデバイスを再起動してください。",
    outputs: [
      {
        promptId: "1",
        promptName: "Technical Documentation Translation",
        text: "インストール後、すべての変更を適用するためにデバイスを再起動してください。",
        score: 5,
        comment: "",
      },
      {
        promptId: "2",
        promptName: "Marketing Content Translation",
        text: "インストール後は、すべての変更を適用するために、お使いのデバイスを再起動してください。",
        score: 4,
        comment: "",
      },
    ],
  },
  {
    id: "3",
    sourceText: "This feature is not compatible with older versions of the operating system.",
    referenceTranslation: "この機能は、古いバージョンのオペレーティングシステムとは互換性がありません。",
    outputs: [
      {
        promptId: "1",
        promptName: "Technical Documentation Translation",
        text: "この機能は、古いバージョンのオペレーティングシステムとは互換性がありません。",
        score: 5,
        comment: "",
      },
      {
        promptId: "2",
        promptName: "Marketing Content Translation",
        text: "この機能は、オペレーティングシステムの古いバージョンでは使用できません。",
        score: 3,
        comment: "Missing technical precision",
      },
    ],
  },
]

export function EvaluationResults() {
  const [results, setResults] = useState(mockResults)

  const handleScoreChange = (resultId: string, promptId: string, score: number) => {
    setResults(
      results.map((result) => {
        if (result.id === resultId) {
          return {
            ...result,
            outputs: result.outputs.map((output) => {
              if (output.promptId === promptId) {
                return { ...output, score }
              }
              return output
            }),
          }
        }
        return result
      }),
    )
  }

  const handleCommentChange = (resultId: string, promptId: string, comment: string) => {
    setResults(
      results.map((result) => {
        if (result.id === resultId) {
          return {
            ...result,
            outputs: result.outputs.map((output) => {
              if (output.promptId === promptId) {
                return { ...output, comment }
              }
              return output
            }),
          }
        }
        return result
      }),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Evaluation Results</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Results
          </Button>
          <Button>Save Evaluation</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prompt Comparison</CardTitle>
          <CardDescription>Comparing the differences between the evaluated prompts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">Technical Documentation Translation (v1.2)</h3>
              <p className="text-sm font-mono whitespace-pre-wrap">
                You are a technical translator specializing in [SOURCE_LANGUAGE] to [TARGET_LANGUAGE] translations.
                Translate the following technical documentation, maintaining all technical terminology accurately.
                Preserve formatting such as bullet points and numbered lists.
                <span className="bg-green-100 dark:bg-green-900/30">
                  If specific technical terms should not be translated, keep them in the original language and format
                  them in italics.
                </span>
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">Marketing Content Translation (v2.1)</h3>
              <p className="text-sm font-mono whitespace-pre-wrap">
                You are a marketing translator specializing in adapting persuasive content from [SOURCE_LANGUAGE] to
                [TARGET_LANGUAGE]. Translate the following marketing content, maintaining the emotional impact and
                persuasive elements.
                <span className="bg-yellow-100 dark:bg-yellow-900/30">
                  Adapt cultural references as needed to resonate with the target audience.
                </span>
                Preserve the tone, style, and brand voice of the original content.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Source Text</TableHead>
              <TableHead className="w-[200px]">Reference Translation</TableHead>
              <TableHead>Technical Documentation Translation (v1.2)</TableHead>
              <TableHead>Marketing Content Translation (v2.1)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <TableRow key={result.id}>
                <TableCell className="align-top">{result.sourceText}</TableCell>
                <TableCell className="align-top">{result.referenceTranslation}</TableCell>
                {result.outputs.map((output) => (
                  <TableCell key={output.promptId} className="align-top">
                    <div className="space-y-2">
                      <p>{output.text}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              className={`w-6 h-6 ${
                                (output.score || 0) >= star ? "text-yellow-500" : "text-gray-300 dark:text-gray-600"
                              }`}
                              onClick={() => handleScoreChange(result.id, output.promptId, star)}
                            >
                              ★
                            </button>
                          ))}
                        </div>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Comment</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <Textarea
                                placeholder="Add your comment here..."
                                value={output.comment || ""}
                                onChange={(e) => handleCommentChange(result.id, output.promptId, e.target.value)}
                                rows={5}
                              />
                            </div>
                            <Button className="w-full">Save Comment</Button>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
