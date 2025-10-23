import React, { useState, forwardRef } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const SearchableSelect = forwardRef(({
  options = [],
  value,
  onValueChange,
  placeholder = "Seleccione...",
  searchPlaceholder = "Buscar...",
  emptyText = "No se encontraron resultados.",
  className,
  popoverClassName,
  disabled = false,
}, ref) => {
  const [open, setOpen] = useState(false);

  // Normalizar comparación para soportar ids numéricos/cadena (evita que no se muestre el valor seleccionado)
  const valueKey = value != null ? String(value) : '';
  const selectedOption = options.find(option => String(option.value) === valueKey);

  const handleSelect = (currentValue) => {
    const option = options.find(o => o.label.toLowerCase() === currentValue.toLowerCase());
    if (option) {
      if (typeof onValueChange === 'function') {
        onValueChange(option.value);
      }
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100", className)}
          disabled={disabled}
          title={selectedOption ? selectedOption.label : placeholder}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", popoverClassName)} align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      String(value) === String(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

SearchableSelect.displayName = 'SearchableSelect';

export default SearchableSelect;