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
        promptName: "技术文档翻译",
        text: "ソフトウェアアップデートには、重要なセキュリティパッチとパフォーマンスの向上が含まれています。",
        score: 5,
        comment: "完美的技术翻译",
      },
      {
        promptId: "2",
        promptName: "营销内容翻译",
        text: "ソフトウェアの更新には、重要なセキュリティ修正と性能向上が含まれています。",
        score: 4,
        comment: "不错，但术语不够精确",
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
        promptName: "技术文档翻译",
        text: "インストール後、すべての変更を適用するためにデバイスを再起動してください。",
        score: 5,
        comment: "",
      },
      {
        promptId: "2",
        promptName: "营销内容翻译",
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
        promptName: "技术文档翻译",
        text: "この機能は、古いバージョンのオペレーティングシステムとは互換性がありません。",
        score: 5,
        comment: "",
      },
      {
        promptId: "2",
        promptName: "营销内容翻译",
        text: "この機能は、オペレーティングシステムの古いバージョンでは使用できません。",
        score: 3,
        comment: "缺乏技术精确性",
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
        <h2 className="text-2xl font-bold tracking-tight">评估结果</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            导出结果
          </Button>
          <Button>保存评估</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>提示比较</CardTitle>
          <CardDescription>比较已评估提示之间的差异</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">技术文档翻译 (v1.2)</h3>
              <p className="text-sm font-mono whitespace-pre-wrap">
                您是一位专门从事 [源语言] 到 [目标语言] 翻译的技术译员。
                请翻译以下技术文档，并准确保留所有技术术语。
                请保留项目符号和编号列表等格式。
                <span className="bg-green-100 dark:bg-green-900/30">
                  如果特定技术术语不应翻译，请保留原文并在格式上使用斜体。
                </span>
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">营销内容翻译 (v2.1)</h3>
              <p className="text-sm font-mono whitespace-pre-wrap">
                您是一位营销译员，专门将 [源语言] 的说服性内容改编为 [目标语言]。
                请翻译以下营销内容，并保持其情感冲击力和说服元素。
                <span className="bg-yellow-100 dark:bg-yellow-900/30">
                  请根据需要调整文化参考，以引起目标受众的共鸣。
                </span>
                请保留原始内容的语调、风格和品牌声音。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">源文本</TableHead>
              <TableHead className="w-[200px]">参考译文</TableHead>
              <TableHead>技术文档翻译 (v1.2)</TableHead>
              <TableHead>营销内容翻译 (v2.1)</TableHead>
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
                              <DialogTitle>添加评论</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <Textarea
                                placeholder="在此处添加您的评论..."
                                value={output.comment || ""}
                                onChange={(e) => handleCommentChange(result.id, output.promptId, e.target.value)}
                                rows={5}
                              />
                            </div>
                            <Button className="w-full">保存评论</Button>
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
