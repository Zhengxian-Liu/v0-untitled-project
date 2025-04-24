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
        return versionId ? `Prompt (ID: ...${versionId.slice(-6)})` : "N/A";
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl"> {/* Wider modal */}
                <DialogHeader>
                    <DialogTitle>{session.session_name}</DialogTitle>
                    <DialogDescription>
                        {session.session_description || "No description."}
                        <span className="block text-xs text-muted-foreground mt-1">
                            Saved at: {new Date(session.saved_at).toLocaleString()}
                        </span>
                         <span className="block text-xs text-muted-foreground">
                            Project: {session.config.project || "N/A"} | Language: {session.config.language || "N/A"}
                         </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2"> {/* Scrollable content */}
                    {/* Configuration Section */}
                    <h3 className="font-semibold mb-2">Configuration Used</h3>
                    <div className="grid grid-cols-3 gap-4 mb-4 text-sm border p-3 rounded-md">
                        <div>
                            <h4 className="font-medium mb-1">Columns:</h4>
                            <ul className="list-disc list-inside text-muted-foreground">
                                {session.config.columns.map((col, index) => (
                                    <li key={index}>
                                        Prompt: {getPromptNameFromConfig(col.selectedVersionId)}
                                        (Model: {col.modelId || "N/A"})
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="col-span-2">
                             <h4 className="font-medium mb-1">Test Set ({session.config.testSet.length} items):</h4>
                             <ScrollArea className="h-24 border rounded-md p-2 bg-muted/50">
                                <ul className="list-disc list-inside text-muted-foreground">
                                    {session.config.testSet.map((item, index) => (
                                        <li key={index} className="truncate" title={item.sourceText}>
                                            {item.sourceText}
                                            {item.referenceText ? ` (Ref: ${item.referenceText.slice(0,30)}...)` : ''}
                                        </li>
                                    ))}
                                </ul>
                             </ScrollArea>
                        </div>
                    </div>

                    <Separator />

                    {/* Results Section */}
                    <h3 className="font-semibold mb-2 mt-4">Results</h3>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Reference</TableHead>
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
                                                        <div>
                                                            <p className="mb-1">{result.modelOutput || "(No Output)"}</p>
                                                            { (result.score || result.comment) &&
                                                                <div className="text-xs border-t pt-1 mt-1 text-muted-foreground">
                                                                    {result.score && <Badge variant="outline">Score: {result.score}</Badge>}
                                                                    {result.comment && <p className="mt-1 italic">Comment: {result.comment}</p>}
                                                                </div>
                                                            }
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
                            Close
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 