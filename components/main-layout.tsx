"use client"

import type React from "react"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PromptLibrary } from "@/components/prompt-library"
import { PromptEditor } from "@/components/prompt-editor"
import { EvaluationPanel } from "@/components/evaluation-panel"
import { MainNav } from "@/components/main-nav"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import type { Prompt } from "@/types"
import { SavedSessionsList } from "@/components/saved-sessions-list"
import { ProtectedRoute } from "./protected-route"
import { useAuth } from "@/lib/authContext"

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState("library")
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const { user, logout } = useAuth()
  const currentLanguage = user?.language ?? "en"

  const handlePromptSelect = (prompt: Prompt) => {
    setSelectedPrompt(prompt)
    setActiveTab("editor")
  }

  const handleNewPrompt = () => {
    setSelectedPrompt(null)
    setActiveTab("editor")
  }

  const triggerLibraryRefresh = () => {
    console.log("Triggering library refresh...")
    setRefreshKey(prevKey => prevKey + 1)
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col">
        <MainNav
          user={user}
          logout={logout}
          currentLanguage={currentLanguage}
        />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="flex items-center justify-between mb-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="library">Prompt Library</TabsTrigger>
                    <TabsTrigger value="editor" disabled={activeTab !== 'editor' && !selectedPrompt}>Prompt Editor</TabsTrigger>
                    <TabsTrigger value="evaluate">Evaluate</TabsTrigger>
                    <TabsTrigger value="saved-sessions">Saved Sessions</TabsTrigger>
                  </TabsList>
                  {(activeTab === 'library' || activeTab === 'editor') && (
                      <Button onClick={handleNewPrompt} className="ml-auto">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Prompt
                      </Button>
                  )}
                </div>
                <TabsContent value="library" className="mt-6">
                  <PromptLibrary
                    key={refreshKey}
                    onPromptSelect={handlePromptSelect}
                    currentLanguage={currentLanguage}
                  />
                </TabsContent>
                <TabsContent value="editor" className="mt-6">
                  <PromptEditor
                    prompt={selectedPrompt}
                    onSaveSuccess={triggerLibraryRefresh}
                    currentLanguage={currentLanguage}
                  />
                </TabsContent>
                <TabsContent value="evaluate" className="mt-6">
                  <EvaluationPanel currentLanguage={currentLanguage} />
                </TabsContent>
                <TabsContent value="saved-sessions" className="mt-6">
                  <SavedSessionsList />
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
