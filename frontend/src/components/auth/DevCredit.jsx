import { Linkedin, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { visitService } from "@/services/visitService";

export function DevCredit({ className, muted = true }) {
  const textClass = muted ? "text-muted-foreground" : "text-white/60";
  const hoverClass = muted ? "hover:text-foreground" : "hover:text-white";
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <p className={cn("text-xs", textClass)}>Developed by Fahath Mohamed</p>
      <div className="flex items-center gap-3">
        <a
          href="https://www.linkedin.com/in/fahath-mohamed-3ab47416b/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => visitService.track("linkedin_click")}
          className={cn("flex items-center gap-1.5 text-xs transition-colors", textClass, hoverClass)}
        >
          <Linkedin className="h-3.5 w-3.5" />
          LinkedIn
        </a>
        <a
          href="https://fahathamm.com"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => visitService.track("website_click")}
          className={cn("flex items-center gap-1.5 text-xs transition-colors", textClass, hoverClass)}
        >
          <Globe className="h-3.5 w-3.5" />
          Portfolio
        </a>
      </div>
    </div>
  );
}
