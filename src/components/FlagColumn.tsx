import React from 'react';
import { UiFlagInstance } from '../types/flags';

interface FlagColumnProps {
  title: string;
  kind: 'entry' | 'exit';
  flags: UiFlagInstance[];
  onAdd(): void;
  onEdit(flag: UiFlagInstance): void;
  onDelete(id: string): void;
}

export const FlagColumn: React.FC<FlagColumnProps> = ({
  title,
  flags,
  onAdd,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="flex-1 flex flex-col border rounded-md p-3 min-h-[200px] max-h-[480px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{title}</h3>
        <button
          type="button"
          className="px-2 py-1 text-sm border rounded-md"
          onClick={onAdd}
        >
          + Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {flags.length === 0 && (
          <div className="text-xs text-gray-500 italic">
            No flags selected yet.
          </div>
        )}
        {flags.map((flag) => (
          <div
            key={flag.id}
            className="border rounded-md px-2 py-1 flex flex-col gap-1 bg-white"
          >
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium truncate">
                {flag.title || flag.name}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => onEdit(flag)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs text-red-600 underline"
                  onClick={() => onDelete(flag.id)}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-600 truncate">
              {summarizeParams(flag.params)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function summarizeParams(params: Record<string, any>): string {
  const parts: string[] = [];
  for (const [key, spec] of Object.entries(params)) {
    if (!spec) continue;
    switch (spec.kind) {
      case 'values':
        parts.push(`${key}={${spec.values.join(',')}}`);
        break;
      case 'range':
        parts.push(`${key}=${spec.start}..${spec.stop} step=${spec.step}${spec.inclusive ? ' (incl)' : ''}`);
        break;
      case 'log_range':
        parts.push(
          `${key}=log[${spec.start}..${spec.stop}, n=${spec.num}${
            spec.roundToTick ? `, tick=${spec.roundToTick}` : ''
          }]`
        );
        break;
      case 'as_is':
        parts.push(`${key}=AS_IS`);
        break;
      default:
        break;
    }
  }
  return parts.join('  •  ');
}
