"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import {
  ChevronDown,
  Save,
  GitBranch,
  Code,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  BookmarkPlus,
  Bookmark,
  AlertTriangle,
  Loader2,
  Check,
  Library,
} from "lucide-react"
import type { Prompt, PromptSection, SavedSection, ProductionPrompt } from "@/types"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiClient } from "@/lib/apiClient"
import { PredefinedTemplate, predefinedSectionTemplates } from "@/lib/prompt-templates"
import { v4 as uuidv4 } from 'uuid'
import { TagPalette } from "@/components/TagPalette"

// +++ ADD: Type for fetched prompt structure M +++
type PromptStructure = {
  output_requirement: string;
  task_info: string;
  // character_info?: string; // Add later if needed
}
// +++ END ADD +++

type Template = {
  id: string
  name: string
  description: string
  text: string
}

type Snippet = {
  id: string
  name: string
  text: string
}

const templates: Template[] = [
  {
    id: "1",
    name: "基本翻译模板",
    description: "用于常规翻译任务的简单模板",
    text: "您是一位专注于[源语言]到[目标语言]翻译的译者。请翻译以下文本，并尽可能保持原文的含义、语气和风格。",
  },
  {
    id: "2",
    name: "技术文档模板",
    description: "针对技术内容翻译优化",
    text: "您是一位专注于[源语言]到[目标语言]翻译的技术译者。请翻译以下技术文档，并准确保留所有技术术语。请保留项目符号和编号列表等格式。",
  },
]

const snippets: Snippet[] = [
  {
    id: "1",
    name: "保留格式",
    text: "请保留所有格式，包括项目符号、编号列表和段落换行。",
  },
  {
    id: "2",
    name: "文化本地化",
    text: "请对任何文化参考进行调整，使其适合目标受众，同时保持原文含义。",
  },
]

const availableProjects = [
  { id: "genshin", name: "原神" },
  { id: "honkai", name: "崩坏：星穹铁道" },
  { id: "zenless", name: "绝区零" },
]

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

const sectionTypes = [
  { id: "role", name: "角色定义" },
  { id: "context", name: "上下文" },
  { id: "instructions", name: "说明" },
  { id: "examples", name: "示例" },
  { id: "output", name: "输出要求" },
  { id: "constraints", name: "限制" },
  { id: "custom", name: "自定义部分" },
]

// Mock saved sections that could be reused across prompts
const mockSavedSections: SavedSection[] = [
  {
    id: "1",
    name: "标准译者角色",
    type: "role",
    content:
      "您是一位专业的翻译人员，专注于将游戏从[源语言]本地化为[目标语言]。",
  },
  {
    id: "2",
    name: "保留角色语音",
    type: "instructions",
    content:
      "在翻译中保持角色独特的语音和个性特征。请特别注意定义角色的说话模式、口头禅和语言习惯。",
  },
  {
    id: "3",
    name: "游戏术语一致性",
    type: "context",
    content:
      "此游戏对物品、技能和地点使用特定术语。请参考词汇表并确保这些术语的翻译一致。",
  },
  {
    id: "4",
    name: "对话示例",
    type: "examples",
    content:
      '\'\'\'源文："さあ、冒険を始めよう！"\n译文："那么，开始我们的冒险吧！"\n\n源文："この剣の力を見せてやる！"\n译文："就让你见识一下这把剑的力量！"\'\'\'',
  },
  {
    id: "5",
    name: "标准输出格式",
    type: "output",
    content: "请按以下格式提供翻译：\n1. 源文本\n2. 译文\n3. 注释（如有）",
  },
]

// Mock data for production prompts
const mockProductionPrompts: ProductionPrompt[] = [
  {
    id: "prod1",
    project: "genshin",
    language: "ja",
    promptId: "1",
    promptName: "技术文档翻译",
  },
  {
    id: "prod2",
    project: "honkai",
    language: "fr",
    promptId: "2",
    promptName: "营销内容翻译",
  },
  {
    id: "prod3",
    project: "zenless",
    language: "es",
    promptId: "3",
    promptName: "法律文件翻译",
  },
]

// --- Update Props Type --- M
interface PromptEditorProps {
  prompt: Prompt | null;
  onSaveSuccess?: () => void;
  currentLanguage: string; // Add currentLanguage prop
}

// --- Constant for Select placeholder value --- M
const SELECT_PLACEHOLDER_VALUE = "--none--";

// Use the updated Props type
export function PromptEditor({ prompt, onSaveSuccess, currentLanguage }: PromptEditorProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined)
  const [isProduction, setIsProduction] = useState(false)
  const [version, setVersion] = useState("1.0")
  const [sections, setSections] = useState<PromptSection[]>(() => [
    { id: uuidv4(), typeId: "role", name: "角色定义", content: "", order: 0 },
    { id: uuidv4(), typeId: "context", name: "上下文", content: "", order: 1 },
    { id: uuidv4(), typeId: "instructions", name: "说明", content: "", order: 2 },
  ])
  const [showSaveSectionDialog, setShowSaveSectionDialog] = useState(false)
  const [sectionToSave, setSectionToSave] = useState<PromptSection | null>(null)
  const [newSectionName, setNewSectionName] = useState("")
  const [showInsertSectionDialog, setShowInsertSectionDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // --- Restore state for production check --- M
  const [currentProductionPrompt, setCurrentProductionPrompt] = useState<Prompt | null>(null)
  const [isLoadingProductionCheck, setIsLoadingProductionCheck] = useState(false)
  const [showProductionConfirmDialog, setShowProductionConfirmDialog] = useState(false)
  // --- End Restore ---

  // +++ ADD: State for fetched backend templates M +++
  const [promptStructure, setPromptStructure] = useState<PromptStructure | null>(null);
  const [isLoadingStructure, setIsLoadingStructure] = useState(true);
  const [structureError, setStructureError] = useState<string | null>(null);
  // +++ END ADD +++

  // --- Versioning State --- M
  const [versionHistory, setVersionHistory] = useState<Prompt[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [currentlyLoadedVersionId, setCurrentlyLoadedVersionId] = useState<string | null>(null)
  // --- End Versioning State ---

  // --- Function to fetch version history --- M
  const fetchVersionHistory = async (basePromptId: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const url = `/prompts/base/${basePromptId}/versions`;
      const historyData = await apiClient<Prompt[]>(url);
      // Sort history newest first (optional, backend might already do this)
      historyData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setVersionHistory(historyData);
      console.log("获取版本历史记录时出错:", historyData);
    } catch (err) {
      console.error("获取版本历史记录时出错:", err);
      const errorMsg = err instanceof Error ? err.message : "未知错误";
      setHistoryError(errorMsg);
      toast.error(`加载版本历史记录失败： ${errorMsg}`);
      setVersionHistory([]); // Clear history on error
    } finally {
      setIsLoadingHistory(false);
    }
  };
  // --- End fetch function ---

  useEffect(() => {
    // Reset version history when prompt changes
    setVersionHistory([]);
    setIsLoadingHistory(false);
    setHistoryError(null);

    if (prompt) {
      // Load state from the passed prompt object
      setName(prompt.name || "")
      setDescription(prompt.description || "")
      setSections(prompt.sections && prompt.sections.length > 0 ? prompt.sections : [])
      setSelectedProject(prompt.project)
      setIsProduction(prompt.isProduction || false)
      setVersion(prompt.version || "1.0")
      // --- Set currently loaded ID and fetch history --- M
      setCurrentlyLoadedVersionId(prompt.id);
      if (prompt.base_prompt_id) {
         fetchVersionHistory(prompt.base_prompt_id);
      } else {
         // This case shouldn't happen if prompts are created correctly
         console.warn("编辑器中加载的提示缺少 base_prompt_id！无法获取历史记录。");
         setHistoryError("无法获取历史记录：提示基本 ID 缺失。");
      }
      // --- End fetch --- M
    } else {
      // Reset form for new prompt (set default sections with new structure)
      setName("")
      setDescription("")
      setIsProduction(false)
      setSelectedProject(undefined)
      setVersion("1.0")
      setSections([
        { id: uuidv4(), typeId: "role", name: "角色定义", content: "", order: 0 },
        { id: uuidv4(), typeId: "context", name: "上下文", content: "", order: 1 },
        { id: uuidv4(), typeId: "instructions", name: "说明", content: "", order: 2 },
      ])
      // --- Clear loaded ID for new prompt --- M
      setCurrentlyLoadedVersionId(null);
      // --- End Clear ---
    }
  }, [prompt])

  // +++ ADD: Effect to fetch backend prompt structure M +++
  useEffect(() => {
    const fetchPromptStructure = async () => {
      setIsLoadingStructure(true);
      setStructureError(null);
      try {
        const data = await apiClient<PromptStructure>("/prompt-structure"); // Assumes API endpoint is /api/v1/prompt-structure
        setPromptStructure(data);
      } catch (err) {
        console.error("获取提示结构时出错:", err);
        const errorMsg = err instanceof Error ? err.message : "发生未知错误";
        setStructureError(errorMsg);
        toast.error(`加载提示结构失败： ${errorMsg}`);
        setPromptStructure(null); // Clear structure on error
      } finally {
        setIsLoadingStructure(false);
      }
    };

    fetchPromptStructure();
  }, []); // Empty dependency array means run once on mount
  // +++ END ADD +++

  // Effect to check production status
  useEffect(() => {
    const fetchCurrentProductionPrompt = async () => {
      if (selectedProject && currentLanguage) {
        try {
          // --- Use apiClient --- M
          const url = `/prompts/production/?project=${encodeURIComponent(selectedProject)}&language=${encodeURIComponent(currentLanguage)}`;
          const data = await apiClient<Prompt>(url);
          // --- End Use --- M
          setCurrentProductionPrompt(data);
        } catch (error: any) {
          if (error.message.includes("404")) { // Check error message for 404
            setCurrentProductionPrompt(null);
          } else {
            console.error("获取生产提示状态时出错:", error);
            setCurrentProductionPrompt(null);
          }
        } finally { setIsLoadingProductionCheck(false); }
      } else { setCurrentProductionPrompt(null); }
    };
    fetchCurrentProductionPrompt();
  }, [selectedProject, currentLanguage]);

  // --- Version Select Handler --- M
  const handleVersionSelect = (selectedPrompt: Prompt) => {
    console.log("Loading version:", selectedPrompt.id, selectedPrompt.version);

    // Update all relevant form states with the selected version's data
    setName(selectedPrompt.name || "");
    setDescription(selectedPrompt.description || "");
    setSections(selectedPrompt.sections && selectedPrompt.sections.length > 0 ? selectedPrompt.sections : []);
    setSelectedProject(selectedPrompt.project);
    setIsProduction(selectedPrompt.isProduction || false);
    setVersion(selectedPrompt.version || "?.?"); // Update displayed version

    // Update the tracker for which version is currently loaded
    setCurrentlyLoadedVersionId(selectedPrompt.id);

    toast.info(`已加载版本 ${selectedPrompt.version}`);
  };
  // --- End Version Select Handler ---

  const handleTemplateSelect = (template: Template) => {
    // When selecting a template, replace the first section with the template text
    if (sections.length > 0) {
      const newSections = [...sections]
      newSections[0].content = template.text
      setSections(newSections)
    } else {
      // Corrected to use new PromptSection structure
      setSections([{
        id: uuidv4(), // Generate new UUID
        typeId: "instructions", // Use typeId
        name: "说明", // Default name for instructions
        content: template.text,
        order: 0 // Set order
      }])
    }
  }

  const handleSnippetInsert = (snippet: Snippet, sectionId: string) => {
    // Insert snippet into the specified section
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          return {
            ...section,
            content: section.content + "\n\n" + snippet.text,
          }
        }
        return section
      }),
    )
  }

  const handleSectionContentChange = (sectionId: string, content: string) => {
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          return { ...section, content }
        }
        return section
      }),
    )
  }

  const handleSectionTypeChange = (sectionId: string, newTypeId: string) => {
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          const sectionTypeInfo = sectionTypes.find((st) => st.id === newTypeId)
          return {
            ...section,
            typeId: newTypeId,
            name: newTypeId === "custom" ? section.name : sectionTypeInfo?.name || section.name,
          }
        }
        return section
      }),
    )
  }

  const handleSectionNameChange = (sectionId: string, name: string) => {
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          return { ...section, name }
        }
        return section
      }),
    )
  }

  const handleAddSection = () => {
    const newSection: PromptSection = {
      id: uuidv4(),
      typeId: "custom",
      name: "新部分",
      content: "",
      order: sections.length,
    };
    setSections([...sections, newSection]);
  }

  const handleDeleteSection = (sectionId: string) => {
    setSections(sections.filter((section) => section.id !== sectionId))
  }

  const handleMoveSection = (sectionId: string, direction: "up" | "down") => {
    const index = sections.findIndex((section) => section.id === sectionId)
    if ((direction === "up" && index === 0) || (direction === "down" && index === sections.length - 1)) {
      return // Can't move further in this direction
    }

    const newSections = [...sections]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    const temp = newSections[index]
    newSections[index] = newSections[targetIndex]
    newSections[targetIndex] = temp

    setSections(newSections)
  }

  const handleSaveSection = (section: PromptSection) => {
    setSectionToSave(section)
    setNewSectionName(section.name)
    setShowSaveSectionDialog(true)
  }

  const confirmSaveSection = () => {
    // In a real app, this would save to a database
    console.log("正在保存部分:", { ...sectionToSave, name: newSectionName })
    setShowSaveSectionDialog(false)
  }

  const handleInsertSavedSection = (savedSection: SavedSection) => {
    const newSection: PromptSection = {
      id: uuidv4(),
      typeId: savedSection.type,
      name: savedSection.name,
      content: savedSection.content,
      order: sections.length,
    };
    setSections([...sections, newSection]);
    setShowInsertSectionDialog(false)
  }

  // Add a function to assemble the complete prompt from all sections
  const assembleCompletePrompt = () => {
    return sections
      .map((section) => {
        return `### ${section.name}\n${section.content}`
      })
      .join("\n\n")
  }

  // --- Restore handleProductionChange with Dialog logic --- M
  const handleProductionChange = (checked: boolean) => {
    if (checked) {
       // Check if a *different* production prompt exists for this project (and fixed language)
       if (currentProductionPrompt && currentProductionPrompt.id !== prompt?.id) {
           setShowProductionConfirmDialog(true); // Show dialog
       } else {
           setIsProduction(true); // Set state directly
       }
    } else {
        setIsProduction(false); // Always allow unchecking
    }
  };

  // Restore the confirmation handler
  const confirmProductionChange = () => {
    setIsProduction(true);
    setShowProductionConfirmDialog(false);
  };
  // --- End Restore ---

  // --- Constants and Helper for Variable Highlighting --- M
  const KNOWN_VARIABLES = [
      "{SOURCE_TEXT}", "{TARGET_LANGUAGE}", "{PREVIOUS_CONTEXT}", "{FOLLOWING_CONTEXT}", 
      "{TERMINOLOGY}", "{SIMILAR_TRANSLATIONS}", "{ADDITIONAL_INSTRUCTIONS}", 
      // Future placeholders from prompt_logic.md (ensure exact match)
      "{nameChs}", "{name}", "{gender}", "{age}", "{occupation}", 
      "{faction}", "{personality}", "{speakingStyle}", "{sampleDialogue}", "{writingStyle}" 
      // Add any other placeholders used in templates
  ];
  const variableRegex = new RegExp(`(${KNOWN_VARIABLES.map(v => v.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`, 'g');

  // --- Preview Logic --- M
  // Helper function to highlight variables in text
  const highlightVariables = (text: string): React.ReactNode => {
    if (!text) return null;
    const parts = text.split(variableRegex);
    return parts.map((part, index) => {
      if (KNOWN_VARIABLES.includes(part)) {
        return (
          <code key={index} className="bg-primary/10 text-primary font-semibold rounded px-1 py-0.5">{part}</code>
        );
      }
      return part;
    });
  };

  const assembleSystemPromptPreview = () => {
    const rulesXml = sections
      .map((section) => {
        const tag = getSectionTag(section);
        return `<${tag}>\n${section.content}\n</${tag}>`;
      })
      .join("\n\n");

    const fullSystemPrompt = `${rulesXml}\n\n${promptStructure?.output_requirement || "加载输出要求时出错..."}`;
    console.log("Assembled System Prompt Preview:", fullSystemPrompt);
    return highlightVariables(fullSystemPrompt);
  };

  const assembleUserPromptPreview = () => {
    // +++ UPDATE: Use fetched template M +++
    let userPrompt = promptStructure?.task_info || "加载任务信息时出错...";
    // +++ END UPDATE +++
    userPrompt = userPrompt.replace("{TARGET_LANGUAGE}", currentLanguage || "{TARGET_LANGUAGE}");
    // Highlight after substitution
    return highlightVariables(userPrompt);
  };
  // --- End Preview Logic ---

  const handleSave = async () => {
    console.log("Save button clicked!");

    // --- MODIFIED: Handle both Create (POST) and Save New Version (PUT) --- M
    const isCreatingNew = !prompt; // True if prompt prop is null
    const method = isCreatingNew ? "POST" : "PUT";
    const endpoint = isCreatingNew
      ? `/prompts/`
      : `/prompts/${currentlyLoadedVersionId}`;

    // Add a check for PUT if the loaded ID is missing (shouldn't happen)
    if (method === "PUT" && !currentlyLoadedVersionId) {
        toast.error("无法保存：编辑器中未加载基本版本。");
        console.error("保存中止：PUT 请求的 currentlyLoadedVersionId 为空。");
        return;
    }

    // Payload preparation - needs slight adjustment based on method
    const basePayload = {
      name: name,
      description: description,
      sections: sections,
      project: selectedProject || null,
      language: currentLanguage,
      isProduction: isProduction,
      // version: version, // Don't send version - backend handles it
    };

    // For PUT, the payload matches PromptUpdate (all optional)
    // For POST, the payload matches PromptCreate (all required from PromptBase)
    // Our basePayload includes everything needed for PromptCreate implicitly.
    const promptData = basePayload;

    // --- End MODIFICATION ---

    console.log(`Attempting to ${method} prompt data to ${endpoint}:`, promptData);

    try {
      // --- Use apiClient --- M
      const savedPromptVersion = await apiClient<Prompt>(endpoint, {
        method: method,
        body: JSON.stringify(promptData),
        // apiClient sets Content-Type header automatically for JSON body
      });
      // --- End Use --- M
      const successMessage = isCreatingNew
        ? `提示已成功创建为版本 ${savedPromptVersion.version}！`
        : `提示已成功保存为新版本 ${savedPromptVersion.version}！`;
      toast.success(successMessage);

      // Update local state
      setVersion(savedPromptVersion.version || "?.?");
      // Update the currently loaded ID to the newly saved version's ID
      setCurrentlyLoadedVersionId(savedPromptVersion.id);

      // Refetch history to include the new version
      if (savedPromptVersion.base_prompt_id) {
          fetchVersionHistory(savedPromptVersion.base_prompt_id);
      }

      if (onSaveSuccess) {
        onSaveSuccess();
      }

    } catch (error) {
      console.error(`创建/保存提示时出错 ${isCreatingNew ? '' : ''}:`, error);
      toast.error(`创建/保存提示失败 ${isCreatingNew ? '' : ''}: ${error instanceof Error ? error.message : error}`);
    }
  };

  // >>> ADD LOG <<<
  console.log("[PromptEditor Render] showPreview state:", showPreview);

  // +++ ADD: Handler for inserting predefined template M +++
  const handlePredefinedTemplateInsert = (template: PredefinedTemplate, sectionId: string) => {
    setSections(
      sections.map((section) => {
        if (section.id === sectionId) {
          // Append the template content to the existing content
          const newContent = section.content
            ? `${section.content}\n\n${template.content}`
            : template.content;
          return {
            ...section,
            content: newContent,
          };
        }
        return section;
      }),
    );
    toast.info(`模板 "${template.name}" 已插入。`);
  };
  // +++ END ADD +++

  // ---------------------------------------------------------------------------
  // Helper: map section typeId + language to XML tag name
  // Keep in sync with backend logic (app/core/prompt_assembler._tag_name).
  // ---------------------------------------------------------------------------
  const getTagName = (typeId: string, language: string = "en"): string => {
    const mappingEn: Record<string, string> = {
      role: "Role_Definition",
      context: "Context",
      instructions: "Instructions",
      examples: "Examples",
    };

    const lower = (typeId || "").toLowerCase();

    if (mappingEn[lower]) return mappingEn[lower];

    // For custom/unknown types, derive from the provided name later by caller.
    return ""; // Caller should handle fallback.
  };

  const sanitizeTagName = (raw: string): string => {
    // Replace non-alphanumerics with underscore, collapse, ensure leading letter
    let tag = raw.trim().replace(/[^0-9a-zA-Z]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    if (!tag || !/^[A-Za-z]/.test(tag)) tag = `C_${tag}`;
    return tag || "Custom_Section";
  };

  const getSectionTag = (sec: PromptSection): string => {
    const mapped = getTagName(sec.typeId, currentLanguage);
    return mapped || sanitizeTagName(sec.name);
  };

  // Compute dynamic tags from current sections (unique list)
  const dynamicTags = Array.from(new Set(sections.map(getSectionTag)));

  // Update fixedTags when promptStructure changes
  useEffect(() => {
    if (promptStructure) {
      const tags = [
        ...extractTags(promptStructure.output_requirement),
        ...extractTags(promptStructure.task_info),
      ];
      setFixedTags([...new Set(tags)]);
    }
  }, [promptStructure]);

  // --- Textarea refs and insertion logic ---
  const textAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const handleTagInsert = (tagStr: string) => {
    if (!activeSectionId) return;
    const ta = textAreaRefs.current[activeSectionId];
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    const newVal = `${before}${tagStr}${after}`;
    ta.value = newVal;
    // Update state
    setSections(
      sections.map((sec) =>
        sec.id === activeSectionId ? { ...sec, content: newVal } : sec
      )
    );
    // Restore caret after inserted tag
    const caretPos = start + tagStr.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caretPos, caretPos);
    });
  };

  // --- Fixed-template tag handling ---
  const [fixedTags, setFixedTags] = useState<string[]>([]);

  // Helper to extract all XML opening tag names from a template string
  const extractTags = (str: string): string[] => {
    if (!str) return [];
    const matches = Array.from(str.matchAll(/<([A-Za-z][\w\-]*)>/g)).map((m) => m[1]);
    return [...new Set(matches)];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          {prompt ? `编辑中: ${prompt.name}` : "创建新提示"}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
              console.log("[PromptEditor] Toggle Preview Button Clicked. Current showPreview:", showPreview);
              setShowPreview(!showPreview);
          }}>
            {showPreview ? "隐藏预览" : "显示预览"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                版本: {version}
                {isLoadingHistory ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-1.5 text-sm font-semibold">版本历史</div>
              {historyError && (
                 <div className="px-2 py-1.5 text-sm text-destructive">{historyError}</div>
              )}
              {!isLoadingHistory && !historyError && versionHistory.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">(未找到历史记录)</div>
              )}
              {!isLoadingHistory && !historyError && versionHistory.map((histPrompt) => (
                <DropdownMenuItem
                  key={histPrompt.id}
                  onSelect={() => handleVersionSelect(histPrompt)}
                  className="cursor-pointer"
                  disabled={histPrompt.id === currentlyLoadedVersionId}
                >
                  <span className="mr-auto">
                    版本 {histPrompt.version}
                    {histPrompt.is_latest && <Badge variant="secondary" className="ml-2">最新</Badge>}
                    {histPrompt.isProduction && <Badge variant="destructive" className="ml-2">生产</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(histPrompt.created_at).toLocaleDateString()}
                  </span>
                  {histPrompt.id === currentlyLoadedVersionId && <Check className="ml-2 h-4 w-4"/>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">提示名称</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="输入提示名称" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">描述</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="输入简短描述"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project">项目</Label>
            <Select
              value={selectedProject ?? SELECT_PLACEHOLDER_VALUE}
              onValueChange={(value) => setSelectedProject(value === SELECT_PLACEHOLDER_VALUE ? undefined : value)}
            >
              <SelectTrigger id="project">
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_PLACEHOLDER_VALUE}>-- 无 --</SelectItem>
                {availableProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {showPreview && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>完整提示预览</CardTitle>
              <CardDescription>显示提示组件如何为 LLM 组装。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2 text-muted-foreground">系统提示预览:</h4>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="whitespace-pre-wrap font-mono text-sm overflow-auto max-h-[300px]">
                    {assembleSystemPromptPreview()}
                  </pre>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-muted-foreground">用户提示预览 (模板):</h4>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="whitespace-pre-wrap font-mono text-sm overflow-auto max-h-[300px]">
                    {assembleUserPromptPreview()}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>提示部分</Label>
            <div className="flex gap-2">
              <Dialog open={showInsertSectionDialog} onOpenChange={setShowInsertSectionDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Bookmark className="mr-2 h-4 w-4" />
                    插入已保存部分
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>插入已保存部分</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4 max-h-[400px] overflow-y-auto">
                    {mockSavedSections.map((section) => (
                      <div
                        key={section.id}
                        className="cursor-pointer rounded-lg border p-4 hover:bg-muted"
                        onClick={() => handleInsertSavedSection(section)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{section.name}</h4>
                          <Badge>{section.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono line-clamp-2">{section.content}</p>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              {/* --- COMMENT OUT/REMOVE CONFUSING TOP-LEVEL TEMPLATE BUTTON M --- */}
              {/* <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Code className="mr-2 h-4 w-4" />
                    Use Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select a Template</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="cursor-pointer rounded-lg border p-4 hover:bg-muted"
                        onClick={() => {
                          handleTemplateSelect(template) // This was the old logic
                        }}
                      >
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog> */}
              {/* --- END COMMENT OUT --- */}

              <Button variant="outline" size="sm" onClick={handleAddSection}>
                <Plus className="mr-2 h-4 w-4" />
                添加部分
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {sections.map((section, index) => (
              <Card key={section.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <Select
                        value={section.typeId}
                        onValueChange={(value) => handleSectionTypeChange(section.id, value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="部分类型" />
                        </SelectTrigger>
                        <SelectContent>
                          {sectionTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {section.typeId === "custom" && (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={section.name}
                            onChange={(e) => handleSectionNameChange(section.id, e.target.value)}
                            placeholder="部分名称"
                            className="flex-1"
                          />
                          <Badge variant="secondary" className="text-[10px] font-mono px-2 whitespace-nowrap">
                            {`<${getSectionTag(section)}>`}
                          </Badge>
                        </div>
                      )}
                      {section.typeId !== "custom" && (
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{section.name}</CardTitle>
                          <Badge variant="secondary" className="text-[10px] font-mono px-2 whitespace-nowrap">
                            {`<${getSectionTag(section)}>`}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveSection(section.id, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveSection(section.id, "down")}
                        disabled={index === sections.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleSaveSection(section)}>
                        <BookmarkPlus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSection(section.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={section.content}
                    onChange={(e) => handleSectionContentChange(section.id, e.target.value)}
                    onFocus={() => setActiveSectionId(section.id)}
                    ref={(el) => {
                      textAreaRefs.current[section.id] = el;
                    }}
                    placeholder={`在此输入${section.name.toLowerCase()}...`}
                    className="font-mono min-h-[120px]"
                  />
                  {/* Tag palette for this section */}
                  <div className="mt-2 border rounded-md p-2 bg-muted/10">
                    <TagPalette
                      fixedTags={fixedTags}
                      dynamicTags={dynamicTags}
                      onInsert={(tag) => handleTagInsert(tag)}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end pt-0 gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!predefinedSectionTemplates[section.typeId] || predefinedSectionTemplates[section.typeId].length === 0}
                      >
                        <Library className="mr-2 h-4 w-4" />
                        插入模板
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {(predefinedSectionTemplates[section.typeId] || []).map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onSelect={() => handlePredefinedTemplateInsert(template, section.id)}
                          className="cursor-pointer"
                        >
                          {template.name}
                        </DropdownMenuItem>
                      ))}
                      {(!predefinedSectionTemplates[section.typeId] || predefinedSectionTemplates[section.typeId].length === 0) && (
                         <DropdownMenuItem disabled>此部分类型无模板</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Code className="mr-2 h-4 w-4" />
                        插入片段
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>插入片段</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        {snippets.map((snippet) => (
                          <div
                            key={snippet.id}
                            className="cursor-pointer rounded-lg border p-4 hover:bg-muted"
                            onClick={() => {
                              handleSnippetInsert(snippet, section.id)
                            }}
                          >
                            <h4 className="font-medium">{snippet.name}</h4>
                            <p className="text-sm text-muted-foreground font-mono">{snippet.text}</p>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="is-production"
            checked={isProduction}
            onCheckedChange={handleProductionChange}
          />
          <label
            htmlFor="is-production"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            标记为生产
          </label>
          {isLoadingProductionCheck && <span className="text-sm text-muted-foreground ml-2">(检查中...)</span>}
          {!isLoadingProductionCheck && currentProductionPrompt && currentProductionPrompt.id !== prompt?.id && (
            <span className="text-sm text-muted-foreground ml-2">
              当前生产提示: <span className="font-medium">{currentProductionPrompt.name}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          保存
        </Button>
        <Button variant="outline">另存为新版本</Button>
        <Button variant="outline">
          <GitBranch className="mr-2 h-4 w-4" />
          创建分支
        </Button>
      </div>

      <Dialog open={showSaveSectionDialog} onOpenChange={setShowSaveSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存部分</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="section-name">部分名称</Label>
              <Input
                id="section-name"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="为此部分输入名称"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveSectionDialog(false)}>
              取消
            </Button>
            <Button onClick={confirmSaveSection}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Restore Production Confirm Dialog --- M */}
      <Dialog open={showProductionConfirmDialog} onOpenChange={setShowProductionConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更改生产提示?</DialogTitle>
            <DialogDescription>
              对于所选项目和语言 ({currentLanguage})，已存在生产提示 ({currentProductionPrompt?.name})。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center p-4 border rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              <div className="text-sm">
                继续操作将替换现有的生产提示。
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductionConfirmDialog(false)}>
              取消
            </Button>
            <Button onClick={confirmProductionChange}>确认更改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* --- End Restore --- */}

      {/* --- UPDATE: Read-only display for fixed prompt parts (use state) M --- */}
      <div className="space-y-4">
        <Card className="bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">(系统提示) 输出要求 (固定)</CardTitle>
            <CardDescription className="text-xs">模型将被指示遵循此输出格式。</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStructure && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {structureError && <p className="text-sm text-destructive">错误: {structureError}</p>}
            {promptStructure && (
              <pre className="whitespace-pre-wrap font-mono text-sm p-4 rounded-md bg-background/50 overflow-auto max-h-[150px]">
                {/* Display fetched content */}
                {promptStructure.output_requirement}
              </pre>
            )}
          </CardContent>
        </Card>
        <Card className="bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">(用户提示) 任务信息 (模板)</CardTitle>
            <CardDescription className="text-xs">此结构将用运行时数据（源文本、翻译记忆库等）填充。</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStructure && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {structureError && <p className="text-sm text-destructive">错误: {structureError}</p>}
            {promptStructure && (
              <pre className="whitespace-pre-wrap font-mono text-sm p-4 rounded-md bg-background/50 overflow-auto max-h-[250px]">
                {/* Use highlighting helper here as well, substitute language */}
                {highlightVariables(promptStructure.task_info.replace("{TARGET_LANGUAGE}", currentLanguage || "{TARGET_LANGUAGE}"))}
              </pre>
            )}
          </CardContent>
        </Card>
        {/* Optional: Placeholder for Character Info */}
         {/* <Card> ... Character Info Display ... </Card> */}
      </div>
      {/* --- END UPDATE --- */}

    </div>
  )
}

