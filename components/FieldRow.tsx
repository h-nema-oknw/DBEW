'use client';

import React, { memo, useState, useEffect } from 'react';
import { Field, AppSettings } from '@/lib/types';
import { GripVertical, X } from 'lucide-react';
import { Draggable } from '@hello-pangea/dnd';

interface FieldRowProps {
  tableId: string;
  field: Field;
  index: number;
  environmentId: string | null;
  dbEnvironments: AppSettings['dbEnvironments'];
  onUpdateField: (tableId: string, fieldId: string, updates: Partial<Field>) => void;
  onValidateFieldName: (tableId: string, fieldId: string, name: string, element: HTMLInputElement) => boolean;
  onDeleteField: (tableId: string, fieldId: string) => void;
}

export const FieldRow = memo(({
  tableId,
  field,
  index,
  environmentId,
  dbEnvironments,
  onUpdateField,
  onValidateFieldName,
  onDeleteField,
}: FieldRowProps) => {
  const env = dbEnvironments.find(e => e.id === environmentId);
  const typeExists = env?.defaultTypes.some(t => t.name === field.type);

  const [localName, setLocalName] = useState(field.name || "");
  const [localLength, setLocalLength] = useState(field.length || "");
  const [localNotes, setLocalNotes] = useState(field.notes || "");

  useEffect(() => { setLocalName(field.name || ""); }, [field.name]);
  useEffect(() => { setLocalLength(field.length || ""); }, [field.length]);
  useEffect(() => { setLocalNotes(field.notes || ""); }, [field.notes]);

  const handleNameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (localName !== field.name) {
      if (onValidateFieldName(tableId, field.id, localName, e.target)) {
        onUpdateField(tableId, field.id, { name: localName });
      } else {
        setLocalName(field.name || "");
      }
    }
  };

  const handleLengthBlur = () => {
    if (localLength !== field.length) {
      onUpdateField(tableId, field.id, { length: localLength });
    }
  };

  const handleNotesBlur = () => {
    if (localNotes !== field.notes) {
      onUpdateField(tableId, field.id, { notes: localNotes });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <Draggable draggableId={field.id} index={index}>
      {(provided, snapshot) => (
        <tr 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`border-b border-slate-800/30 group ${snapshot.isDragging ? 'bg-sky-900/40 shadow-lg relative z-50 display-table' : 'hover:bg-slate-800/20 transition-colors'}`}
          style={{
            ...provided.draggableProps.style,
            display: snapshot.isDragging ? 'table' : undefined,
          }}
        >
          <td className="px-2 py-1.5 text-center text-slate-600">
            <div {...provided.dragHandleProps} className="cursor-grab hover:text-sky-400 opacity-50 hover:opacity-100 flex items-center justify-center">
              <GripVertical size={12} />
            </div>
          </td>
          <td className="px-4 py-1.5 text-center">
            <input 
              type="checkbox" 
              checked={field.isPrimaryKey} 
              onChange={(e) => onUpdateField(tableId, field.id, { isPrimaryKey: e.target.checked })}
              className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 cursor-pointer"
            />
          </td>
          <td className="px-4 py-1.5">
            <input 
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none focus:ring-0 p-0 font-mono text-sky-300 outline-none"
            />
          </td>
          <td className="px-4 py-1.5">
            {environmentId ? (
              <select 
                value={field.type || ""}
                onChange={(e) => {
                  const typeName = e.target.value;
                  const typeDef = env?.defaultTypes.find(t => t.name === typeName);
                  onUpdateField(tableId, field.id, { 
                    type: typeName,
                    length: typeDef?.defaultLength || field.length
                  });
                }}
                className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-300 cursor-pointer outline-none"
              >
                <option value="" disabled className="bg-slate-900">型を選択...</option>
                {field.type && !typeExists && (
                  <option value={field.type} className="bg-slate-900">{field.type}</option>
                )}
                {env?.defaultTypes.map(t => (
                  <option key={t.name} value={t.name} className="bg-slate-900">{t.name}</option>
                ))}
              </select>
            ) : (
              <input 
                value={field.type || ""}
                onChange={(e) => onUpdateField(tableId, field.id, { type: e.target.value })}
                className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-300 outline-none"
              />
            )}
          </td>
          <td className="px-4 py-1.5">
            <input 
              value={localLength}
              onChange={(e) => setLocalLength(e.target.value)}
              onBlur={handleLengthBlur}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-500 outline-none"
            />
          </td>
          <td className="px-4 py-1.5 text-center">
            <input 
              type="checkbox" 
              checked={field.isNullable} 
              onChange={(e) => onUpdateField(tableId, field.id, { isNullable: e.target.checked })}
              className="rounded border-slate-700 bg-slate-900 text-sky-500 cursor-pointer"
            />
          </td>
          <td className="px-4 py-1.5">
            <input 
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              onKeyDown={handleKeyDown}
              placeholder="備考を入力..."
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-500 italic outline-none"
            />
          </td>
          <td className="px-4 py-1.5 text-center">
            <button 
              onClick={() => onDeleteField(tableId, field.id)}
              className="text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all cursor-pointer"
            >
              <X size={12} />
            </button>
          </td>
        </tr>
      )}
    </Draggable>
  );
});

FieldRow.displayName = 'FieldRow';
