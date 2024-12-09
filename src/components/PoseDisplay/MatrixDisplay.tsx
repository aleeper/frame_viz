import React from 'react';
import { Matrix } from '../types/pose';

interface MatrixDisplayProps {
  matrix: Matrix;
  label?: string;
}

export function MatrixDisplay({ matrix, label }: MatrixDisplayProps) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md">
        {label && <h3 className="text-lg font-semibold mb-2">{label}</h3>}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <tbody>
              {matrix.map((row, i) => (
                <tr key={i} className={i === 3 ? 'border-t border-gray-300' : ''}>
                  {row.map((value, j) => (
                    <td
                      key={j}
                      className={`px-2 py-1 text-right font-mono ${
                        j === 3 ? 'border-l border-gray-300' : ''
                      }`}
                    >
                      {value.toFixed(4)}
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