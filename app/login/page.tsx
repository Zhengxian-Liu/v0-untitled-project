"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Import for redirection
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner'; // For displaying errors/info
import { useAuth } from '@/lib/authContext'; // Import useAuth

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth(); // Get login function from context
    const router = useRouter(); // Get router for redirection

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        console.log("Login attempt with:", { username });

        try {
            const response = await fetch(`${API_BASE_URL}/auth/token`, {
                method: 'POST',
                // Use FormData for OAuth2PasswordRequestForm compatibility
                headers: {
                    // 'Content-Type': 'application/x-www-form-urlencoded', // Browser sets this automatically for FormData
                },
                body: new URLSearchParams({
                    username: username,
                    password: password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                const errorDetail = data.detail || `HTTP error! Status: ${response.status}`;
                throw new Error(errorDetail);
            }

            // Assuming response has { access_token: string, token_type: string }
            if (data.access_token) {
                login(data.access_token); // Call context login function
                toast.success("登录成功！");
                // Redirect to homepage after successful login
                router.push('/');
            } else {
                throw new Error("Login failed: No access token received.");
            }

        } catch (error) {
            console.error("Login failed:", error);
            toast.error(`登录失败： ${error instanceof Error ? error.message : "未知错误"}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="w-full max-w-sm mx-auto">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold">PromptCraft 登录</CardTitle>
                    <CardDescription>请输入您的用户名和密码</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">用户名</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="您的用户名"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">密码</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? "登录中..." : "登录"}
                        </Button>
                    </form>
                    <div className="mt-4 text-center text-sm">
                        还没有账户？{" "}
                        <Link href="/register" className="underline">
                            注册
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 