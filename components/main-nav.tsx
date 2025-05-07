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
             Workspace: {currentLanguage ? (availableLanguages.find(l => l.id === currentLanguage)?.name || currentLanguage) : '...'}
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
                  <AvatarFallback>{user?.username?.substring(0, 2).toUpperCase() || '??'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.username || 'User'}</p>
                  <p className="text-xs leading-none text-muted-foreground">Lang: {currentLanguage || 'N/A'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Add Profile/Settings links later */}
              {/* <DropdownMenuItem>Profile</DropdownMenuItem> */}
              {/* <DropdownMenuItem>Settings</DropdownMenuItem> */}
              {/* <DropdownMenuSeparator /> */}
              <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
