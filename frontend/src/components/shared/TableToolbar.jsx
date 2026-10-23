"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function TableToolbar({ search, onSearchChange, placeholder = "Search...", action }) {
  const [inputValue, setInputValue] = useState(search ?? "");
  const timerRef = useRef(null);

  // Sync if URL search param is cleared externally (e.g. back-navigation)
  useEffect(() => {
    setInputValue(search ?? "");
  }, [search]);

  const handleChange = (value) => {
    setInputValue(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearchChange(value), 350);
  };

  return (
    <div className="flex items-center justify-end gap-2 mb-4">
      <div className="relative w-56">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 h-8 text-sm"
        />
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
