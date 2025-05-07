"use client";

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast" // Using Shadcn toast
import { Eye, Trash2, Loader2 } from 'lucide-react'; // Icons for actions and Loader2
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
} from "@/components/ui/alert-dialog" // ADDED: Alert Dialog

import { apiClient } from "@/lib/apiClient"; // Import helper

// Import the summary type we expect from the API
import type { EvaluationSessionSummary, EvaluationSession } from "@/types";
// Import the modal component
import { ViewSessionDetailsModal } from './view-session-details-modal';

export function SavedSessionsList() {
    const [sessions, setSessions] = useState<EvaluationSessionSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast() // ADDED: Shadcn toast hook

    // --- State for View Modal --- M
    const [selectedSessionDetails, setSelectedSessionDetails] = useState<EvaluationSession | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    // --- End State ---

    // --- Refactored fetchSessions --- M
    const fetchSessions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiClient<EvaluationSessionSummary[]>('/evaluation-sessions/');
            if (Array.isArray(data)) {
                 setSessions(data as EvaluationSessionSummary[]);
            } else {
                throw new Error("从API接收到的数据格式无效");
            }
        } catch (err) {
            console.error("获取已保存的会话失败:", err);
            const errorMsg = err instanceof Error ? err.message : "发生未知错误";
            setError(errorMsg);
            toast({ // Use Shadcn toast
                 title: "加载会话失败",
                 description: errorMsg,
                 variant: "destructive"
             });
        } finally {
            setIsLoading(false);
        }
    };
    // --- End Refactor ---

    // Fetch saved sessions from the API on component mount
    useEffect(() => {
        console.log("SavedSessionsList: Fetching from URL:");
        fetchSessions();
    }, []); // Run once on mount

    // --- Updated handleViewSession --- M
    const handleViewSession = async (sessionId: string) => {
        console.log("View session clicked:", sessionId);
        setIsLoadingDetails(true);
        setSelectedSessionDetails(null); // Clear previous
        setIsViewModalOpen(false); // Close initially
        try {
            // --- Use apiClient --- M
            const data = await apiClient<EvaluationSession>(`/evaluation-sessions/${sessionId}`);
            // --- End Use --- M
            setSelectedSessionDetails(data as EvaluationSession);
            setIsViewModalOpen(true); // Open modal with fetched data

        } catch (err) {
             console.error("获取会话详细信息失败:", err);
             const errorMsg = err instanceof Error ? err.message : "发生未知错误";
             toast({ // Use Shadcn toast
                title: "加载会话详细信息失败",
                description: errorMsg,
                variant: "destructive"
             });
        } finally {
            setIsLoadingDetails(false);
        }
    };
    // --- End Update ---

    // --- MODIFIED Delete Handler --- M
    const handleDeleteSession = async (sessionId: string) => {
        console.log("Delete session clicked:", sessionId);
        try {
          await apiClient(`/evaluation-sessions/${sessionId}`, { method: 'DELETE' });
          toast({
               title: "会话已删除",
               description: `已保存的会话 ${sessionId} 已成功删除。`
          });
          fetchSessions(); // Refresh the list
        } catch (err) {
             console.error("删除会话失败:", err);
             const errorMsg = err instanceof Error ? err.message : "发生未知错误";
             toast({
                title: "删除会话时出错",
                description: errorMsg,
                variant: "destructive"
             });
        }
    };
    // --- End MODIFIED Delete Handler ---

    if (isLoading) {
        return <div>正在加载已保存的会话...</div>;
    }

    if (error) {
        return <div className="text-red-500">加载已保存的会话时出错: {error}</div>;
    }

    return (
        <div> {/* Wrap list and modal */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>会话名称</TableHead>
                            <TableHead>描述</TableHead>
                            <TableHead>保存于</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sessions.length > 0 ? (
                            sessions.map((session) => (
                                <TableRow key={session.id}>
                                    <TableCell className="font-medium">{session.session_name}</TableCell>
                                    <TableCell className="text-muted-foreground truncate max-w-sm">
                                        {session.session_description || '-'}
                                    </TableCell>
                                    <TableCell>{new Date(session.saved_at).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleViewSession(session.id)}
                                            title="查看详情"
                                            className="mr-1 h-8 w-8"
                                            disabled={isLoadingDetails && selectedSessionDetails?.id === session.id} // Disable button while loading *this* session
                                            >
                                            {isLoadingDetails && selectedSessionDetails?.id === session.id ? (
                                                 <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                        {/* --- ADDED Delete Dialog --- M */}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="删除会话"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>您确定吗？</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        此操作将永久删除已保存的会话 <code className="mx-1 font-mono bg-muted px-1 rounded">{session.session_name}</code> (ID: {session.id})。此操作无法撤销。
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                                    <AlertDialogAction
                                                         onClick={() => handleDeleteSession(session.id)}
                                                         className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                                     >
                                                        永久删除
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        {/* --- End Delete Dialog --- */}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                    未找到已保存的评估会话。
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* --- Render Modal --- M */}
            <ViewSessionDetailsModal
                session={selectedSessionDetails}
                isOpen={isViewModalOpen}
                onOpenChange={setIsViewModalOpen}
            />
            {/* --- End Render Modal --- */}
        </div>
    );
} 