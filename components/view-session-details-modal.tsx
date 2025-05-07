"use client";

import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
    DialogClose // Added for explicit close button
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { EvaluationSession } from "@/types"; // Import the full type

interface ViewSessionDetailsModalProps {
    session: EvaluationSession | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ViewSessionDetailsModal({ session, isOpen, onOpenChange }: ViewSessionDetailsModalProps) {

    if (!session) {
        return null; // Don't render if no session data
    }

    // Helper to get prompt info (replace with actual logic later if needed)
    const getPromptNameFromConfig = (versionId: string | null): string => {
        // This is tricky as we don't have the full prompt objects here
        // We might need to store prompt names in the config or fetch them separately
        return versionId ? `提示 (ID: ...${versionId.slice(-6)})` : "不适用";
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl"> {/* Wider modal */}
                <DialogHeader>
                    <DialogTitle>{session.session_name}</DialogTitle>
                    <DialogDescription>
                        {session.session_description || "无描述."}
                        <span className="block text-xs text-muted-foreground mt-1">
                            保存于: {new Date(session.saved_at).toLocaleString()}
                        </span>
                         <span className="block text-xs text-muted-foreground">
                            项目: {session.config.project || "不适用"} | 语言: {session.config.language || "不适用"}
                         </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2"> {/* Scrollable content */}
                    {/* Configuration Section */}
                    <h3 className="font-semibold mb-2">使用配置</h3>
                    <div className="grid grid-cols-3 gap-4 mb-4 text-sm border p-3 rounded-md">
                        <div>
                            <h4 className="font-medium mb-1">列:</h4>
                            <ul className="list-disc list-inside text-muted-foreground">
                                {session.config.columns.map((col, index) => (
                                    <li key={index}>
                                        提示: {getPromptNameFromConfig(col.selectedVersionId)}
                                        (模型: {col.modelId || "不适用"})
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="col-span-2">
                             <h4 className="font-medium mb-1">测试集 ({session.config.testSet.length} 项):</h4>
                             <ScrollArea className="h-24 border rounded-md p-2 bg-muted/50">
                                <ul className="list-disc list-inside text-muted-foreground">
                                    {session.config.testSet.map((item, index) => (
                                        <li key={index} className="truncate" title={item.sourceText}>
                                            {item.sourceText}
                                            {item.referenceText ? ` (参考: ${item.referenceText.slice(0,30)}...)` : ''}
                                        </li>
                                    ))}
                                </ul>
                             </ScrollArea>
                        </div>
                    </div>

                    <Separator />

                    {/* Results Section */}
                    <h3 className="font-semibold mb-2 mt-4">结果</h3>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>源文本</TableHead>
                                    <TableHead>参考文本</TableHead>
                                    {/* Dynamically create headers based on saved config */}
                                    {session.config.columns.map((col, index) => (
                                        <TableHead key={`col-header-${index}`}>
                                            {getPromptNameFromConfig(col.selectedVersionId)}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {session.config.testSet.map((testItem, rowIndex) => (
                                    <TableRow key={`result-row-${rowIndex}`}>
                                        <TableCell className="align-top font-medium">{testItem.sourceText}</TableCell>
                                        <TableCell className="align-top text-muted-foreground">{testItem.referenceText || '-'}</TableCell>
                                        {session.config.columns.map((col, colIndex) => {
                                            // Find the result matching this source text and this column's prompt version
                                            const result = session.results.find(r =>
                                                r.sourceText === testItem.sourceText && r.promptId === col.selectedVersionId
                                            );
                                            return (
                                                <TableCell key={`result-cell-${rowIndex}-${colIndex}`} className="align-top">
                                                    {result ? (
                                                        <div className="space-y-1">
                                                            {/* Model Output */}
                                                            <p className="mb-1">{result.modelOutput || "(无输出)"}</p>

                                                            {/* Manual Score/Comment */}
                                                            {(result.score !== null || result.comment) && (
                                                                <div className="text-xs border-t pt-1 mt-1 text-muted-foreground">
                                                                    {result.score !== null && <Badge variant="outline" className="mr-1">人工评分: {result.score}</Badge>}
                                                                    {result.comment && <p className="mt-1 italic">评论: {result.comment}</p>}
                                                                </div>
                                                            )}

                                                            {/* LLM Judge Score/Rationale */}
                                                            {(result.llm_judge_score !== null || result.llm_judge_rationale) && (
                                                                <div className="text-xs border-t border-dashed pt-1 mt-1 text-muted-foreground">
                                                                    {typeof result.llm_judge_score === 'number' && <Badge variant="secondary" className="mr-1">LLM 评分: {result.llm_judge_score.toFixed(1)}</Badge>}
                                                                    {result.llm_judge_rationale && <p className="mt-1"><span className="font-medium">理由:</span> {result.llm_judge_rationale}</p>}
                                                                    {/* Optionally display judge model ID */}
                                                                    {/* result.llm_judge_model_id && <p className="mt-1 text-gray-400 text-[10px]">Judge Model: {result.llm_judge_model_id}</p> */}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter>
                     <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            关闭
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 