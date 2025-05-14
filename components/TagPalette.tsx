import React from "react";
import { Badge } from "@/components/ui/badge";

interface TagPaletteProps {
  fixedTags: string[];
  dynamicTags: string[];
  onInsert: (tag: string) => void;
}

export const TagPalette: React.FC<TagPaletteProps> = ({ fixedTags, dynamicTags, onInsert }) => {
  const renderTag = (tag: string) => (
    <Badge
      key={tag}
      onClick={() => onInsert(`<${tag}>`)}
      className="cursor-pointer select-none font-mono text-xs mr-1 mb-1"
      variant="outline"
    >
      {`<${tag}>`}
    </Badge>
  );

  return (
    <div className="space-y-3 p-2">
      <div>
        <h4 className="text-sm font-semibold mb-1 text-muted-foreground">固定模板</h4>
        <div className="flex flex-wrap">
          {fixedTags.map(renderTag)}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-1 text-muted-foreground">动态节标签</h4>
        <div className="flex flex-wrap">
          {dynamicTags.map(renderTag)}
        </div>
      </div>
    </div>
  );
}; 