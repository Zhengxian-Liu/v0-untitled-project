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
                throw new Error("Invalid data format received from API");
            }
        } catch (err) {
            console.error("Failed to fetch saved sessions:", err);
            const errorMsg = err instanceof Error ? err.message : "An unknown error occurred";
            setError(errorMsg);
            toast({ // Use Shadcn toast
                 title: "Failed to Load Sessions",
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
             console.error("Failed to fetch session details:", err);
             const errorMsg = err instanceof Error ? err.message : "An unknown error occurred";
             toast({ // Use Shadcn toast
                title: "Failed to Load Session Details",
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
               title: "Session Deleted",
               description: `Saved session ${sessionId} deleted successfully.`
          });
          fetchSessions(); // Refresh the list
        } catch (err) {
             console.error("Failed to delete session:", err);
             const errorMsg = err instanceof Error ? err.message : "An unknown error occurred";
             toast({
                title: "Error Deleting Session",
                description: errorMsg,
                variant: "destructive"
             });
        }
    };
    // --- End MODIFIED Delete Handler ---

    if (isLoading) {
        return <div>Loading saved sessions...</div>;
    }

    if (error) {
        return <div className="text-red-500">Error loading saved sessions: {error}</div>;
    }

    return (
        <div> {/* Wrap list and modal */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Session Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Saved At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
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
                                            title="View Details"
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
                                                    title="Delete Session"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action will permanently delete the saved session <code className="mx-1 font-mono bg-muted px-1 rounded">{session.session_name}</code> (ID: {session.id}). This cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                         onClick={() => handleDeleteSession(session.id)}
                                                         className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                                     >
                                                        Delete Permanently
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
                                    No saved evaluation sessions found.
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