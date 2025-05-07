import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type React from "react"
import type { User } from "@/types"

// --- Update Props: No longer needs setCurrentLanguage --- M
interface MainNavProps {
  currentLanguage: string;
  // setCurrentLanguage: (lang: string) => void;
  // Add user/logout later?
  user: User | null;
  logout: () => void;
}

// --- Define language list locally for display --- M
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
];
// --- End Define ---

export function MainNav({ currentLanguage, user, logout }: MainNavProps) {

  // Remove language mapping logic
  // const workspaceToLang = { ... };
  // const langToWorkspace = { ... };
  // const handleLanguageChange = (workspaceValue: string) => { ... };

  return (
    <header className="border-b">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold text-xl">
            PromptCraft
          </Link>
          {/* Display Current Language from Context */}
          <span className="text-sm font-medium text-muted-foreground border rounded px-2 py-1">
            工作区: {currentLanguage ? (availableLanguages.find(l => l.id === currentLanguage)?.name || currentLanguage) : '...'}
          </span>
          {/* --- Remove Language Selector --- M */}
          {/* <Select ... > ... </Select> */}
          {/* --- End Remove ---
        </div>
        <div className="ml-auto flex items-center gap-4">
           {/* Update User Menu */}
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  {/* Use initials or placeholder */}
                  <AvatarFallback>{user?.username?.substring(0, 2).toUpperCase() || '用户'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.username || '用户'}</p>
                  <p className="text-xs leading-none text-muted-foreground">语言: {currentLanguage || '不适用'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Add Profile/Settings links later */}
              {/* <DropdownMenuItem>Profile</DropdownMenuItem> */}
              {/* <DropdownMenuItem>Settings</DropdownMenuItem> */}
              {/* <DropdownMenuSeparator /> */}
              <DropdownMenuItem onClick={logout}>登出</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
