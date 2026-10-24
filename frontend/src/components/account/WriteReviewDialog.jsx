"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="transition-transform hover:scale-110">
          <Star className={cn("h-7 w-7", n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
        </button>
      ))}
    </div>
  );
}

export function WriteReviewDialog({ open, onOpenChange, onSubmit, loading }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    onSubmit({ rating, title: title || undefined, comment: comment || undefined }, setErrors);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Write a Review</DialogTitle>
          <DialogDescription>Shared publicly once moderated — help other renters decide.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ValidationError errors={errors} />
          <div className="flex flex-col items-center gap-2 py-2">
            <StarPicker value={rating} onChange={setRating} />
            <p className="text-sm text-muted-foreground">{rating} out of 5</p>
          </div>
          <TextInput label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up in a few words" error={errors.title?.[0]} />
          <TextareaInput label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was the vehicle and the owner?" error={errors.comment?.[0]} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
