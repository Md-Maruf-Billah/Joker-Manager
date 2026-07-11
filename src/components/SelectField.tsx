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
    <label className="grid gap-1.5 text-[13px] font-semibold text-inksoft">
      <span>{label}</span>
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger className="flex min-h-[42px] items-center justify-between rounded-[10px] border border-black/[0.14] bg-field px-[13px] text-left text-sm text-ink outline-none transition focus:border-brand-red">
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={8}
            className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[10px] border border-black/10 bg-card p-1 text-ink shadow-panel"
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className={clsx(
                    "relative cursor-pointer rounded-lg px-8 py-2.5 text-sm outline-none",
                    "data-[highlighted]:bg-brand-red data-[highlighted]:text-white"
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
