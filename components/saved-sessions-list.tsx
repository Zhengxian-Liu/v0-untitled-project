"use client";

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, Trash2, Loader2 } from 'lucide-react'; // Icons for actions and Loader2

// Import the summary type we expect from the API
import type { EvaluationSessionSummary, EvaluationSession } from "@/types";
// Import the modal component
import { ViewSessionDetailsModal } from './view-session-details-modal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export function SavedSessionsList() {
    const [sessions, setSessions] = useState<EvaluationSessionSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- State for View Modal --- M
    const [selectedSessionDetails, setSelectedSessionDetails] = useState<EvaluationSession | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    // --- End State ---

    // Fetch saved sessions from the API on component mount
    useEffect(() => {
        const fetchSessions = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`${API_BASE_URL}/evaluation-sessions/`);
                if (!response.ok) {
                    let errorDetail = `HTTP error! status: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorDetail = errorData.detail || errorDetail;
                    } catch (e) { /* Ignore JSON parsing error */ }
                    throw new Error(errorDetail);
                }
                const data = await response.json();
                // Ensure data matches expected type (basic check)
                if (Array.isArray(data)) {
                     setSessions(data as EvaluationSessionSummary[]);
                } else {
                    throw new Error("Invalid data format received from API");
                }
            } catch (err) {
                console.error("Failed to fetch saved sessions:", err);
                const errorMsg = err instanceof Error ? err.message : "An unknown error occurred";
                setError(errorMsg);
                toast.error(`Failed to load saved sessions: ${errorMsg}`);
            } finally {
                setIsLoading(false);
            }
        };

        // Add console log
        console.log("SavedSessionsList: Fetching from URL:", `${API_BASE_URL}/evaluation-sessions/`);
        fetchSessions();
    }, []); // Run once on mount

    // --- Updated handleViewSession --- M
    const handleViewSession = async (sessionId: string) => {
        console.log("View session clicked:", sessionId);
        setIsLoadingDetails(true);
        setSelectedSessionDetails(null); // Clear previous
        setIsViewModalOpen(false); // Close initially
        try {
            const response = await fetch(`${API_BASE_URL}/evaluation-sessions/${sessionId}`);
            if (!response.ok) {
                 let errorDetail = `HTTP error! status: ${response.status}`;
                 try {
                     const errorData = await response.json();
                     errorDetail = errorData.detail || errorDetail;
                 } catch (e) { /* Ignore */ }
                 throw new Error(errorDetail);
            }
            const data = await response.json();
            setSelectedSessionDetails(data as EvaluationSession);
            setIsViewModalOpen(true); // Open modal with fetched data

        } catch (err) {
             console.error("Failed to fetch session details:", err);
             const errorMsg = err instanceof Error ? err.message : "An unknown error occurred";
             toast.error(`Failed to load session details: ${errorMsg}`);
        } finally {
            setIsLoadingDetails(false);
        }
    };
    // --- End Update ---

    const handleDeleteSession = async (sessionId: string) => {
        // TODO: Implement API call to DELETE /api/v1/evaluation-sessions/{sessionId}
        console.log("Delete session clicked:", sessionId);
        if (confirm(`Are you sure you want to delete saved session ${sessionId}?`)) {
             toast.warning(`Deleting session ${sessionId} (Not Implemented Yet)`);
             // After successful deletion, refetch the list:
             // fetchSessions();
        }
    };

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
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteSession(session.id)}
                                            title="Delete Session"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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