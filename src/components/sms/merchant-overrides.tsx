"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Tags, Loader2 } from "lucide-react";
import {
  useOverrides,
  useSaveOverride,
  useDeleteOverride,
} from "./use-sms-data";
import { CATEGORIES, type CategoryKey } from "@/lib/sms/categories";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MerchantOverrides() {
  const overridesQ = useOverrides();
  const saveMut = useSaveOverride();
  const delMut = useDeleteOverride();

  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState<CategoryKey>("food");

  const overrides = overridesQ.data?.overrides ?? [];

  const add = async () => {
    if (!merchant.trim()) {
      toast.error("Enter a merchant name");
      return;
    }
    try {
      await saveMut.mutateAsync({ merchant: merchant.trim(), category });
      toast.success(`Override saved for ${merchant.trim()}`);
      setMerchant("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const remove = async (id: string, merchantName: string) => {
    try {
      await delMut.mutateAsync(id);
      toast.success(`Override removed for ${merchantName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Tags className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <Label className="text-sm font-medium">Merchant Category Overrides</Label>
          <p className="text-[11px] text-muted-foreground">
            Force a merchant to always use a specific category
          </p>
        </div>
        {overrides.length > 0 && (
          <Badge variant="secondary" className="rounded-full text-[10px]">
            {overrides.length}
          </Badge>
        )}
      </div>

      {/* Add new override */}
      <div className="flex gap-2 pl-[42px]">
        <Input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Merchant name (e.g., BESCOM)"
          className="h-8 flex-1 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <Select value={category} onValueChange={(v) => setCategory(v as CategoryKey)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(CATEGORIES).map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={add}
          disabled={saveMut.isPending || !merchant.trim()}
          className="h-8 gap-1 px-2.5"
        >
          {saveMut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* List existing overrides */}
      {overridesQ.isLoading ? (
        <div className="space-y-1.5 pl-[42px]">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-8 rounded-md shimmer" />
          ))}
        </div>
      ) : overrides.length === 0 ? (
        <p className="pl-[42px] text-[11px] text-muted-foreground">
          No overrides yet. Add one above, or edit a transaction's category to
          auto-create an override.
        </p>
      ) : (
        <ScrollArea className="max-h-40 pl-[42px]">
          <ul className="space-y-1">
            {overrides.map((o) => {
              const def = CATEGORIES[o.category as CategoryKey];
              return (
                <li
                  key={o.id}
                  className="group flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {o.merchant}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 text-[9px]", def?.badge)}
                  >
                    {def?.label ?? o.category}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete" className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={() => remove(o.id, o.merchant)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
