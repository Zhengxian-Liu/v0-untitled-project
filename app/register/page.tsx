"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// Use the same list as before, maybe centralize later
const availableLanguages = [
  { id: "en", name: "English" },
  { id: "ja", name: "Japanese" },
  { id: "ko", name: "Korean" },
  { id: "zh", name: "Chinese" },
  { id: "fr", name: "French" },
  { id: "de", name: "German" },
  { id: "es", name: "Spanish" },
  { id: "it", name: "Italian" },
  { id: "ru", name: "Russian" },
  { id: "pt", name: "Portuguese" },
]

export default function RegisterPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [language, setLanguage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async (event: React.FormEvent) => {
        event.preventDefault();
        if (password !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }
        if (!language) {
            toast.error("Please select your primary language.");
            return;
        }
        setIsLoading(true);
        console.log("Registration attempt:", { username, language });

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    language: language
                })
            });

            const data = await response.json();

            if (!response.ok) {
                const errorDetail = data.detail || `HTTP error! Status: ${response.status}`;
                throw new Error(errorDetail);
            }

            toast.success("Registration successful! Please log in.");
            router.push('/login');

        } catch (error) {
             console.error("Registration failed:", error);
             toast.error(`Registration failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
             setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="w-full max-w-sm mx-auto">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold">Register for PromptCraft</CardTitle>
                    <CardDescription>Create your username, password, and select language.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="new_user"
                                required
                                value={username}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                                disabled={isLoading}
                                pattern="^[a-zA-Z0-9_]+$"
                                title="Username can only contain letters, numbers, and underscores."
                            />
                        </div>
                         <div className="space-y-2">
                             <Label htmlFor="language">Primary Language</Label>
                             <Select
                                 required
                                 value={language}
                                 onValueChange={setLanguage}
                                 disabled={isLoading}
                                >
                                 <SelectTrigger id="language">
                                     <SelectValue placeholder="Select language workspace" />
                                 </SelectTrigger>
                                 <SelectContent>
                                     {availableLanguages.map((lang) => (
                                         <SelectItem key={lang.id} value={lang.id}>
                                             {lang.name}
                                         </SelectItem>
                                     ))}
                                 </SelectContent>
                             </Select>
                         </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                minLength={8} // Match backend validation
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? "Registering..." : "Register"}
                        </Button>
                    </form>
                     <div className="mt-4 text-center text-sm">
                         Already have an account?{" "}
                         <Link href="/login" className="underline">
                             Login
                         </Link>
                     </div>
                </CardContent>
            </Card>
        </div>
    );
} 