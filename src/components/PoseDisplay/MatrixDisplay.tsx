import React from 'react';
import { Matrix } from '../types/pose';

interface MatrixDisplayProps {
  matrix: Matrix;
  label?: string;
}

export function MatrixDisplay({ matrix, label }: MatrixDisplayProps) {
    const rowLabels = ["Wx", "Wy", "Wz", ""];
    const columnLabels = ["", "Fx", "Fy", "Fz", ""];
    return (
      <div className="p-1">
        {label && <h3 className="text-lg font-semibold mb-2">{label}</h3>}
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs">
            <tbody>
              <tr>{columnLabels.map((value, j) => (<td key={j}>{columnLabels[j]}</td>))}</tr>
              {matrix.map((row, i) => (
                <tr key={i}>
                  <td className='pr-1 text-left text-xs'>{rowLabels[i]}</td>
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