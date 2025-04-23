import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export function Sidebar() {
  const tags = [
    { id: "1", name: "Technical" },
    { id: "2", name: "Marketing" },
    { id: "3", name: "Legal" },
    { id: "4", name: "Conversational" },
    { id: "5", name: "Formal" },
    { id: "6", name: "Casual" },
  ]

  return (
    <div className="w-64 border-r p-6 hidden md:block">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2">Filters</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="production-only">Show Production Only</Label>
              <div className="flex items-center space-x-2">
                <Checkbox id="production-only" />
                <label
                  htmlFor="production-only"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Production Only
                </label>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Tags</h4>
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
