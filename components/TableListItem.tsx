'use client';

import React, { memo, useState, useEffect } from 'react';
import { Table } from '@/lib/types';
import { GripVertical, Table as TableIcon, Copy, Trash2 } from 'lucide-react';
import { Draggable } from '@hello-pangea/dnd';

interface TableListItemProps {
  table: Table;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Table>) => void;
  onCopy: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}

export const TableListItem = memo(({ 
  table, 
  index, 
  isSelected, 
  onSelect, 
  onUpdate, 
  onCopy, 
  onDeleteRequest 
}: TableListItemProps) => {
  const [localName, setLocalName] = useState(table.name || "");

  useEffect(() => {
    setLocalName(table.name || "");
  }, [table.name]);

  const handleBlur = () => {
    if (localName !== table.name) {
      onUpdate(table.id, { name: localName });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <Draggable draggableId={table.id} index={index}>
      {(provided, snapshot) => (
        <li
          ref={provided.innerRef}
          {...provided.draggableProps}
          onClick={() => onSelect(table.id)}
          className={`px-3 py-2 text-xs flex items-center justify-between rounded group ${isSelected ? 'bg-sky-500/10 text-sky-100' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'} ${snapshot.isDragging ? 'shadow-lg bg-slate-800 ring-1 ring-sky-500' : ''}`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div {...provided.dragHandleProps} className="cursor-grab hover:text-sky-400 opacity-50 hover:opacity-100 text-slate-500 -ml-1 py-1">
              <GripVertical size={12} />
            </div>
            <TableIcon size={12} className={isSelected ? 'text-sky-400' : 'text-slate-600'} />
            <input 
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent border-none focus:ring-0 p-0 text-xs font-medium w-full text-current focus:text-white"
            />
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <Copy 
              size={12} 
              className="text-slate-500 hover:text-sky-400 cursor-pointer" 
              onClick={(e) => { e.stopPropagation(); onCopy(table.id); }}
              title="複製"
            />
            <Trash2 
              size={12} 
              className="text-slate-500 hover:text-red-400 cursor-pointer" 
              onClick={(e) => { 
                e.stopPropagation(); 
                onDeleteRequest(table.id);
              }}
              title="削除"
            />
          </div>
        </li>
      )}
    </Draggable>
  );
});

TableListItem.displayName = 'TableListItem';
