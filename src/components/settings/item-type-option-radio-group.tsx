"use client";

import {
  createElement,
  useCallback,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type ItemTypeOptionRadioGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  getOptionLabel: (option: T) => string;
  renderOption: (option: T, selected: boolean) => ReactNode;
  className?: string;
  getOptionClassName?: (selected: boolean) => string | undefined;
};

export function ItemTypeOptionRadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  getOptionLabel,
  renderOption,
  className,
  getOptionClassName,
}: ItemTypeOptionRadioGroupProps<T>) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusOption = useCallback(
    (index: number) => {
      const clamped =
        ((index % options.length) + options.length) % options.length;
      buttonRefs.current[clamped]?.focus();
    },
    [options.length],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = options.indexOf(value);
    if (currentIndex < 0) {
      return;
    }

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown": {
        event.preventDefault();
        const next = (currentIndex + 1) % options.length;
        onChange(options[next]!);
        focusOption(next);
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        event.preventDefault();
        const previous = (currentIndex - 1 + options.length) % options.length;
        onChange(options[previous]!);
        focusOption(previous);
        break;
      }
      case "Home": {
        event.preventDefault();
        onChange(options[0]!);
        focusOption(0);
        break;
      }
      case "End": {
        event.preventDefault();
        onChange(options[options.length - 1]!);
        focusOption(options.length - 1);
        break;
      }
      default:
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={className}
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => {
        const selected = value === option;

        return (
          <button
            key={option}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            aria-label={getOptionLabel(option)}
            className={getOptionClassName?.(selected)}
            onClick={() => onChange(option)}
          >
            {renderOption(option, selected)}
          </button>
        );
      })}
    </div>
  );
}

export function ItemTypeIconRadioGroup({
  value,
  onChange,
  icons,
  getIcon,
}: {
  value: string;
  onChange: (icon: string) => void;
  icons: readonly string[];
  getIcon: (name: string) => React.ComponentType<{ className?: string }>;
}) {
  return (
    <ItemTypeOptionRadioGroup
      label="Item type icon"
      options={icons}
      value={value}
      onChange={onChange}
      getOptionLabel={(iconName) => iconName}
      className="grid grid-cols-8 gap-1"
      getOptionClassName={(selected) =>
        cn(
          "flex size-9 items-center justify-center rounded-md border",
          selected && "border-primary bg-muted",
        )
      }
      renderOption={(iconName) => {
        const Icon = getIcon(iconName);
        return createElement(Icon, { className: "size-4" });
      }}
    />
  );
}
