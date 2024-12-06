import React from 'react';
import { Representation } from '../types/Representation';

interface RepresentationControlProps {
  value: Representation;
  onChange: (value: Representation) => void;
}

export function RepresentationControl({ value, onChange }: RepresentationControlProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="representaton" className="text-sm font-medium">
        Representation:
      </label>
      <select
        id="representaton"
        value={value}
        onChange={(e) => onChange(e.target.value as Representation)}
        className="rounded-md text-black border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
      >
        <option value={"Quaternion"}>Quaternion</option>
        <option value={"Matrix"}>Matrix</option>
      </select>
    </div>
  );
}