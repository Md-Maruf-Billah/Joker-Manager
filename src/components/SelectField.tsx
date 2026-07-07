import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { clsx } from "clsx";

export type SelectOption = {
  value: string;
  label: string;
  detail?: string;
};

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select"
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-paper">
      <span>{label}</span>
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger className="flex min-h-12 items-center justify-between rounded-md border border-paper/12 bg-felt-900 px-3 text-left text-paper outline-none transition focus:border-gold-400">
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown className="h-4 w-4 text-muted" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={8}
            className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-paper/12 bg-felt-950 p-1 text-paper shadow-panel"
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className={clsx(
                    "relative cursor-pointer rounded px-8 py-2.5 text-sm outline-none",
                    "data-[highlighted]:bg-gold-400 data-[highlighted]:text-ink"
                  )}
                >
                  <Select.ItemText>
                    <span className="block font-semibold">{option.label}</span>
                    {option.detail ? (
                      <span className="block text-xs opacity-75">{option.detail}</span>
                    ) : null}
                  </Select.ItemText>
                  <Select.ItemIndicator className="absolute left-2 top-3">
                    <Check className="h-4 w-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </label>
  );
}

