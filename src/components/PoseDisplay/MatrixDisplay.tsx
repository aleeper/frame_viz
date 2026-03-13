import React from 'react';
import { Matrix } from '../types/pose';

interface MatrixDisplayProps {
  matrix: Matrix;
  label?: string;
  childName?: string;
  parentName?: string;
}

export function MatrixDisplay({ matrix, label, childName, parentName }: MatrixDisplayProps) {
  const rowLabels = ["x", "y", "z", ""];
  const colLabels = ["x", "y", "z", "t"];

  return (
    <div className="p-1">
      {label && <h3 className="text-lg font-semibold mb-2">{label}</h3>}
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <tbody>
            {/* Header row 1: child name spanning the rotation columns */}
            <tr>
              <td />{/* parent-label column */}
              <td />{/* row-label column */}
              <td colSpan={3} className="text-center text-gray-400 pb-0.5 leading-none">
                {childName ?? ''}
              </td>
              <td />{/* translation column */}
            </tr>
            {/* Header row 2: per-column axis labels */}
            <tr>
              <td />
              <td />
              {colLabels.map((lbl, j) => (
                <td key={j} className={`text-center text-gray-500 px-1 leading-none ${j === 3 ? 'border-l border-gray-600' : ''}`}>
                  {lbl}
                </td>
              ))}
            </tr>
            {/* Data rows */}
            {matrix.map((row, i) => (
              <tr key={i}>
                {/* Parent vertical label: rowSpan covers the 3 rotation rows only */}
                {i === 0 && (
                  <td
                    rowSpan={3}
                    className="text-gray-400 pr-0.5 text-center leading-none"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    {parentName ?? ''}
                  </td>
                )}
                {/* Homogeneous row needs an explicit empty cell to fill the parent-label column */}
                {i === 3 && <td />}
                <td className="pr-1 text-left text-gray-500">{rowLabels[i]}</td>
                {row.map((value, j) => (
                  <td
                    key={j}
                    className={`px-1 py-0.5 text-right font-mono text-xs ${
                      j === 3 || j === 0 ? 'border-l border-gray-600' : ''
                    } ${i === 3 || i === 0 ? 'border-t border-gray-600' : ''}`}
                  >
                    {value.toFixed(3)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
