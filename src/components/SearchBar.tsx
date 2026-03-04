import { useCallback, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useClipboardStore } from "@/stores/clipboardStore";

export function SearchBar() {
  const keyword = useClipboardStore((s) => s.keyword);
  const setKeyword = useClipboardStore((s) => s.setKeyword);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setKeyword(value);
      }, 300);
    },
    [setKeyword]
  );

  const handleClear = useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
    setKeyword("");
  }, [setKeyword]);

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 size-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        placeholder="Search clipboard..."
        defaultValue={keyword}
        onChange={handleChange}
        className="pl-9 pr-8 h-8"
      />
      {keyword && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute right-1"
          onClick={handleClear}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}
