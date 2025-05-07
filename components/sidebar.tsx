import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export function Sidebar() {
  const tags = [
    { id: "1", name: "技术" },
    { id: "2", name: "营销" },
    { id: "3", name: "法律" },
    { id: "4", name: "对话" },
    { id: "5", name: "正式" },
    { id: "6", name: "休闲" },
  ]

  return (
    <div className="w-64 border-r p-6 hidden md:block">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2">筛选</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="production-only">仅显示生产版本</Label>
              <div className="flex items-center space-x-2">
                <Checkbox id="production-only" />
                <label
                  htmlFor="production-only"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  仅生产版本
                </label>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">标签</h4>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag.id} variant="outline" className="cursor-pointer hover:bg-muted">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
