'use client';

import React, { memo, useState, useEffect } from 'react';
import { Table, Field, AppSettings } from '@/lib/types';
import { Table as TableIcon, Copy, Trash2, Plus } from 'lucide-react';
import { Droppable, DragDropContext, DropResult } from '@hello-pangea/dnd';
import { FieldRow } from './FieldRow';

interface TableCardProps {
  table: Table;
  isSelected: boolean;
  environmentId: string | null;
  dbEnvironments: AppSettings['dbEnvironments'];
  onSelect: (id: string) => void;
  onUpdateTable: (id: string, updates: Partial<Table>) => void;
  onValidateTableName: (id: string, name: string, element: HTMLInputElement) => boolean;
  onCopyTable: (id: string) => void;
  onDeleteTableRequest: (id: string) => void;
  onAddField: (tableId: string) => void;
  onUpdateField: (tableId: string, fieldId: string, updates: Partial<Field>) => void;
  onValidateFieldName: (tableId: string, fieldId: string, name: string, element: HTMLInputElement) => boolean;
  onDeleteField: (tableId: string, fieldId: string) => void;
  onDragEnd: (result: DropResult) => void;
}

export const TableCard = memo(({
  table,
  isSelected,
  environmentId,
  dbEnvironments,
  onSelect,
  onUpdateTable,
  onValidateTableName,
  onCopyTable,
  onDeleteTableRequest,
  onAddField,
  onUpdateField,
  onValidateFieldName,
  onDeleteField,
  onDragEnd,
}: TableCardProps) => {
  const [localName, setLocalName] = useState(table.name || "");
  const [localDescription, setLocalDescription] = useState(table.description || "");

  useEffect(() => {
    setLocalName(table.name || "");
  }, [table.name]);

  useEffect(() => {
    setLocalDescription(table.description || "");
  }, [table.description]);

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
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div 
      id={`table-card-${table.id}`} 
      onClick={() => onSelect(table.id)}
      className={`bg-slate-900/50 rounded border transition-all overflow-hidden shadow-lg scroll-mt-20 cursor-pointer group/card ${isSelected ? 'border-sky-500 ring-1 ring-sky-500/50 scale-[1.01] shadow-sky-500/10' : 'border-slate-800 hover:border-slate-700'}`}
    >
      <div className={`px-4 py-2 border-b flex items-center justify-between transition-colors ${isSelected ? 'bg-sky-500/20 border-sky-500/30' : 'bg-slate-800 border-slate-700'}`}>
        <div className="flex items-center gap-3">
          <TableIcon size={16} className={isSelected ? 'text-sky-300' : 'text-sky-400'} />
          <input 
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleKeyDown}
            className="font-bold text-sm bg-transparent border-none focus:ring-0 p-0 text-slate-200 tracking-tight"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onCopyTable(table.id); }} 
            className="text-slate-500 hover:text-sky-400 transition-colors p-1"
            title="コピー"
          >
            <Copy size={16} />
          </button>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onDeleteTableRequest(table.id);
            }} 
            className="text-slate-500 hover:text-red-400 transition-colors p-1"
            title="削除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      <div className="p-3 border-b border-slate-800/50 bg-[#111827]/30">
        <input 
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          onKeyDown={handleKeyDown}
          placeholder="テーブル概要を追加..."
          className="w-full text-[11px] text-slate-500 bg-transparent border-none focus:ring-0 p-0 italic truncate"
        />
      </div>

      <div className="overflow-x-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1e293b]/50 text-slate-500 font-bold tracking-widest text-[9px] uppercase border-b border-slate-800">
              <tr>
                <th className="px-2 py-2 w-8"></th>
                <th className="px-4 py-2 w-12 text-center text-amber-500/70">PK</th>
                <th className="px-4 py-2 min-w-[120px]">フィールド名</th>
                <th className="px-4 py-2 w-32">型</th>
                <th className="px-4 py-2 w-20">長さ</th>
                <th className="px-4 py-2 w-12 text-center">Null</th>
                <th className="px-4 py-2">備考</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <Droppable droppableId={`fields-${table.id}`} type="field">
              {(provided) => (
                <tbody 
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {table.fields.map((field, index) => (
                    <FieldRow 
                      key={field.id}
                      tableId={table.id}
                      field={field}
                      index={index}
                      environmentId={environmentId}
                      dbEnvironments={dbEnvironments}
                      onUpdateField={onUpdateField}
                      onValidateFieldName={onValidateFieldName}
                      onDeleteField={onDeleteField}
                    />
                  ))}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>
          </table>
        </DragDropContext>
      </div>

      <div className="px-4 py-3 bg-slate-900/30 flex justify-start">
        <button 
          onClick={(e) => { e.stopPropagation(); onAddField(table.id); }}
          className="flex items-center gap-2 text-[10px] font-bold text-sky-500/70 hover:text-sky-400 transition-all uppercase tracking-widest px-3 py-1.5 rounded bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/10 hover:border-sky-500/20 shadow-sm"
        >
          <Plus size={12} /> フィールドを追加
        </button>
      </div>
    </div>
  );
});

TableCard.displayName = 'TableCard';
