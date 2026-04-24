'use client';

import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Table, Field } from '@/lib/types';
import { Database, Key, Link, Plus } from 'lucide-react';

export type TableNodeProps = Node<{ 
  table: Table;
  onUpdateTable: (id: string, updates: Partial<Table>) => void;
  onAddField: (tableId: string) => void;
  onUpdateField: (tableId: string, fieldId: string, updates: Partial<Field>) => void;
  onValidateTableName: (id: string, name: string, element: HTMLInputElement) => boolean;
  onValidateFieldName: (tableId: string, fieldId: string, name: string, element: HTMLInputElement) => boolean;
  viewMode?: 'all' | 'summary';
  relatedFieldIds?: Set<string>;
}>;

// Inner component for Field row to manage local state
const FieldRowNode = memo(({ 
  tableId, 
  field, 
  onUpdateField, 
  onValidateFieldName 
}: { 
  tableId: string, 
  field: Field, 
  onUpdateField: any, 
  onValidateFieldName: any 
}) => {
  const [localName, setLocalName] = useState(field.name || "");
  useEffect(() => { setLocalName(field.name || ""); }, [field.name]);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (localName !== field.name) {
      if (onValidateFieldName(tableId, field.id, localName, e.target)) {
        onUpdateField(tableId, field.id, { name: localName });
      } else {
        setLocalName(field.name || "");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  return (
    <tr className="group relative">
      <td className="py-0.5 w-4 shrink-0 px-1 relative">
        <div className="flex items-center">
          {field.isPrimaryKey && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-0.5" title="Primary Key" />}
          {field.isForeignKey && <div className="w-1.5 h-1.5 rounded-full bg-sky-400" title="Foreign Key" />}
        </div>
        <Handle 
          type="target" 
          position={Position.Left} 
          id={`target-${field.id}`}
          style={{ left: -12, background: '#38bdf8', width: 6, height: 6, border: 'none' }}
        />
        <Handle 
          type="source" 
          position={Position.Left} 
          id={`source-${field.id}`}
          style={{ left: -12, background: '#38bdf8', width: 6, height: 6, border: 'none' }}
        />
      </td>
      <td className="py-0.5">
        <input 
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="bg-transparent border-none focus:ring-0 p-0 w-full text-sky-300 group-hover:text-sky-200 nodrag"
        />
        {field.notes && (
          <div className="text-[8px] text-slate-500 italic block -mt-1 pb-1">{field.notes}</div>
        )}
      </td>
      <td className="py-0.5 text-right text-slate-500 uppercase pr-2 relative">
        <div className="flex items-center justify-end gap-1">
          <span>{field.type}{field.length ? `(${field.length})` : ''}</span>
        </div>
        <Handle 
          type="target" 
          position={Position.Right} 
          id={`target-${field.id}-right`}
          style={{ right: -12, background: '#38bdf8', width: 6, height: 6, border: 'none' }}
        />
        <Handle 
          type="source" 
          position={Position.Right} 
          id={`source-${field.id}-right`}
          style={{ right: -12, background: '#38bdf8', width: 6, height: 6, border: 'none' }}
        />
      </td>
    </tr>
  );
});
FieldRowNode.displayName = 'FieldRowNode';

export const TableNode = memo(({ data, selected }: NodeProps<TableNodeProps>) => {
  const { 
    table, 
    onUpdateTable, 
    onAddField, 
    onUpdateField, 
    onValidateTableName, 
    onValidateFieldName, 
    viewMode = 'all', 
    relatedFieldIds 
  } = data;

  const [localName, setLocalName] = useState(table.name || "");
  const [localDescription, setLocalDescription] = useState(table.description || "");

  useEffect(() => { setLocalName(table.name || ""); }, [table.name]);
  useEffect(() => { setLocalDescription(table.description || ""); }, [table.description]);

  const handleNameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (localName !== table.name) {
      if (onValidateTableName(table.id, localName, e.target)) {
        onUpdateTable(table.id, { name: localName });
      } else {
        setLocalName(table.name || "");
      }
    }
  };

  const handleDescriptionBlur = () => {
    if (localDescription !== table.description) {
      onUpdateTable(table.id, { description: localDescription });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  const visibleFields = viewMode === 'summary'
    ? table.fields.filter(f => f.isPrimaryKey || relatedFieldIds?.has(f.id))
    : table.fields;

  return (
    <div className={`bg-[#1e293b] border ${selected ? 'border-sky-500 ring-2 ring-sky-500/50' : 'border-slate-600'} rounded shadow-2xl min-w-[200px] overflow-hidden font-sans transition-all duration-200`}>
      <div className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded-t text-xs font-bold border-b border-slate-600 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-1">
          <Database size={14} className="shrink-0" />
          <input 
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleKeyDown}
            className="bg-transparent border-none focus:ring-0 p-0 w-full tracking-tight nodrag font-bold"
          />
        </div>
        <input 
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          onKeyDown={handleKeyDown}
          placeholder="説明を追加..."
          className="bg-transparent border-none focus:ring-0 p-0 w-full text-[9px] font-normal text-slate-400 italic nodrag"
        />
      </div>
      
      <div className="p-1 px-2 space-y-1 text-[10px] font-mono">
        <table className="w-full border-collapse">
          <tbody>
            {visibleFields.map((field) => (
              <FieldRowNode 
                key={field.id}
                tableId={table.id}
                field={field}
                onUpdateField={onUpdateField}
                onValidateFieldName={onValidateFieldName}
              />
            ))}
          </tbody>
        </table>

        {viewMode === 'all' && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAddField(table.id);
            }}
            className="w-full mt-1 py-1 flex items-center justify-center gap-1 text-[9px] text-slate-500 hover:text-sky-400 transition-colors uppercase tracking-widest border-t border-slate-700/50 nodrag"
          >
            <Plus size={10} /> Add Field
          </button>
        )}
      </div>
      
      {/* Handles for generic table-level connections */}
      <Handle type="target" position={Position.Top} id="table-target-top" className="!bg-sky-500 !w-2 !h-2 !border-none" />
      <Handle type="source" position={Position.Bottom} id="table-source-bottom" className="!bg-sky-500 !w-2 !h-2 !border-none" />
      <Handle type="target" position={Position.Left} id="table-target-left" className="!bg-sky-500 !w-2 !h-2 !border-none" />
      <Handle type="source" position={Position.Right} id="table-source-right" className="!bg-sky-500 !w-2 !h-2 !border-none" />
    </div>
  );
});

TableNode.displayName = 'TableNode';
