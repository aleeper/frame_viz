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
      <div className="bg-white p-2 rounded-lg shadow-md">
        {label && <h3 className="text-lg font-semibold mb-2">{label}</h3>}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <tbody>
              <tr>{columnLabels.map((value, j) => (<td>{columnLabels[j]}</td>))}</tr>
              {matrix.map((row, i) => (
                <tr key={i}>
                  <td className='px-1 text-left'>{rowLabels[i]}</td>
                  {row.map((value, j) => (
                    <td
                      key={j}
                      className={`px-2 py-1 text-right font-mono ${
                        j === 3 || j === 0 ? 'border-l border-gray-300' : ''
                      } ${i === 3 || i === 0 ? 'border-t border-gray-300' : ''}`}
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