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
  { id: "en", name: "英语" },
  { id: "ja", name: "日语" },
  { id: "ko", name: "韩语" },
  { id: "zh", name: "中文" },
  { id: "fr", name: "法语" },
  { id: "de", name: "德语" },
  { id: "es", name: "西班牙语" },
  { id: "it", name: "意大利语" },
  { id: "ru", name: "俄语" },
  { id: "pt", name: "葡萄牙语" },
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
            toast.error("密码不匹配。");
            return;
        }
        if (!language) {
            toast.error("请选择您的主要语言。");
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

            toast.success("注册成功！请登录。");
            router.push('/login');

        } catch (error) {
             console.error("Registration failed:", error);
             toast.error(`注册失败： ${error instanceof Error ? error.message : "未知错误"}`);
        } finally {
             setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="w-full max-w-sm mx-auto">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold">注册 PromptCraft</CardTitle>
                    <CardDescription>创建您的用户名、密码并选择语言。</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">用户名</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="新用户"
                                required
                                value={username}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                                disabled={isLoading}
                                pattern="^[a-zA-Z0-9_]+$"
                                title="用户名只能包含字母、数字和下划线。"
                            />
                        </div>
                         <div className="space-y-2">
                             <Label htmlFor="language">主要语言</Label>
                             <Select
                                 required
                                 value={language}
                                 onValueChange={setLanguage}
                                 disabled={isLoading}
                                >
                                 <SelectTrigger id="language">
                                     <SelectValue placeholder="选择语言工作区" />
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
                            <Label htmlFor="password">密码</Label>
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
                            <Label htmlFor="confirmPassword">确认密码</Label>
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
                            {isLoading ? "注册中..." : "注册"}
                        </Button>
                    </form>
                     <div className="mt-4 text-center text-sm">
                         已有账户？{" "}
                         <Link href="/login" className="underline">
                             登录
                         </Link>
                     </div>
                </CardContent>
            </Card>
        </div>
    );
} 