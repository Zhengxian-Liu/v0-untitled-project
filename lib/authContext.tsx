"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { User } from "@/types"; // Import User type for potential future use
import { apiClient } from './apiClient'; // Import apiClient

// Define the shape of the context data
interface AuthContextType {
    token: string | null;
    user: User | null; // User object
    isLoading: boolean; // To check if auth state is being loaded
    login: (token: string) => Promise<void>; // Make async for user fetch
    logout: () => void;
    // Maybe add a function to fetch user details based on token later
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a provider component
interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Function to fetch user details using the current token
    const fetchUser = async (currentToken: string | null) => {
        if (!currentToken) {
            setUser(null);
            setIsLoading(false);
            return;
        }
        try {
            // apiClient will automatically add the token header
            const userData = await apiClient<User>('/auth/users/me');
            setUser(userData);
            console.log("AuthProvider: User data fetched", userData);
        } catch (error) {
            console.error("AuthProvider: Failed to fetch user data:", error);
            // If fetching user fails (e.g., invalid token), log out
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    // Check local storage on initial mount
    useEffect(() => {
        let storedToken: string | null = null;
        try {
            storedToken = localStorage.getItem('authToken');
            if (storedToken) {
                setToken(storedToken);
                fetchUser(storedToken); // Fetch user if token exists
            } else {
                 setIsLoading(false); // No token, not loading
            }
        } catch (error) {
            console.error("Error accessing localStorage:", error);
             setIsLoading(false); // Error, not loading
        }

    }, []); // Run only once on mount

    const login = async (newToken: string) => {
        try {
            localStorage.setItem('authToken', newToken);
            setToken(newToken);
            await fetchUser(newToken); // Fetch user data immediately after login
        } catch (error) {
             console.error("Error during login process:", error);
             // Ensure logout state if login fails badly
             setToken(null);
             setUser(null);
             localStorage.removeItem('authToken');
        }
    };

    const logout = () => {
         try {
            localStorage.removeItem('authToken');
         } catch (error) {
             console.error("Error removing token from localStorage:", error);
         }
         // Always clear state regardless of localStorage success
         setToken(null);
         setUser(null);
    };

    const value = {
        token,
        user,
        isLoading,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Create a hook to use the auth context easily
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 