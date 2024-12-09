import React from 'react';

interface DropdownControlProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  label?: string;
  id: string;
}

export function DropdownControl<T>({
  value,
  onChange,
  options,
  label,
  id,
}: DropdownControlProps<T>) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value as unknown as string} // Type assertion to handle generic
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-md text-black border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={String(option.value)} value={option.value as unknown as string}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
