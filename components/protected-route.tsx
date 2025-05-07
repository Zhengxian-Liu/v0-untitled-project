"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { token, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Wait until loading is finished before checking token
        if (!isLoading) {
            if (!token) {
                // If not loading and no token, redirect to login
                console.log("ProtectedRoute: No token found, redirecting to /login");
                router.replace('/login'); // Use replace to avoid back button to protected route
            }
        }
    }, [token, isLoading, router]);

    // While loading auth state, show a loading indicator (or null)
    if (isLoading) {
        return <div>Loading authentication...</div>; // Or a proper spinner component
    }

    // If loading is done and token exists, render the children
    if (token) {
        return <>{children}</>;
    }

    // If no token and not loading (should have been redirected, but return null as fallback)
    return null;
}; 