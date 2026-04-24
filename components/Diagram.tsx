'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Panel,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
  MarkerType,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Table, Relation, Field } from '@/lib/types';
import { TableNode } from './TableNode';
import { Sparkles, Eye, EyeOff } from 'lucide-react';

const nodeTypes: NodeTypes = {
  table: TableNode,
};

// Custom Edge component to handle curvature for multiple connections
const RelationEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: data?.curvature as number | undefined ?? 0.25,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div 
              style={{
                backgroundColor: '#1e293b',
                color: '#38BDF8',
                padding: '2px 4px',
                borderRadius: '2px',
                fontSize: '10px',
                fontWeight: 700,
                opacity: 0.9,
                whiteSpace: 'nowrap',
                border: '1px solid rgba(56,189,248,0.2)'
              }}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes = {
  relation: RelationEdge,
};

interface DiagramProps {
  tables: Table[];
  relations: Relation[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onAddTable: () => void;
  onAutoLayout: () => void;
  onUpdateTable: (id: string, updates: Partial<Table>) => void;
  onAddField: (tableId: string) => void;
  onUpdateField: (tableId: string, fieldId: string, updates: Partial<Field>) => void;
  onValidateTableName: (id: string, name: string, element: HTMLInputElement) => boolean;
  onValidateFieldName: (tableId: string, fieldId: string, name: string, element: HTMLInputElement) => boolean;
  onSelectTable: (id: string | null) => void;
  selectedTableId: string | null;
  onDeleteNode?: (id: string) => void;
  onDeleteEdge?: (id: string) => void;
  searchTriggerId?: string | null;
}

function DiagramInner({
  tables,
  relations,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAddTable,
  onAutoLayout,
  onUpdateTable,
  onAddField,
  onUpdateField,
  onValidateTableName,
  onValidateFieldName,
  onSelectTable,
  selectedTableId,
  searchTriggerId,
}: DiagramProps) {
  const [viewMode, setViewMode] = useState<'all' | 'summary'>('all');
  const { setCenter } = useReactFlow();

  useEffect(() => {
    if (searchTriggerId && selectedTableId === searchTriggerId) {
      const selectedNode = tables.find(t => t.id === searchTriggerId);
      if (selectedNode) {
        setCenter(selectedNode.position.x + 100, selectedNode.position.y + 100, { zoom: 1, duration: 800 });
      }
    }
  }, [searchTriggerId, selectedTableId, tables, setCenter]);

  const relatedFieldIds = useMemo(() => {
    const ids = new Set<string>();
    relations.forEach(r => {
      if (r.sourceFieldId) ids.add(r.sourceFieldId);
      if (r.targetFieldId) ids.add(r.targetFieldId);
    });
    return ids;
  }, [relations]);

  const nodes = useMemo(() => {
    return tables.map((t) => ({
      id: t.id,
      type: 'table',
      position: t.position,
      selected: t.id === selectedTableId,
      data: { 
        table: t,
        onUpdateTable,
        onAddField,
        onUpdateField,
        onValidateTableName,
        onValidateFieldName,
        viewMode,
        relatedFieldIds
      },
    }));
  }, [tables, onUpdateTable, onAddField, onUpdateField, onValidateTableName, onValidateFieldName, selectedTableId, viewMode, relatedFieldIds]);

  const edges = useMemo(() => {
    const counts: Record<string, number> = {};
    
    return relations.map((r) => {
      const sourceTable = tables.find(t => t.id === r.sourceTableId);
      const targetTable = tables.find(t => t.id === r.targetTableId);
      const sourceField = sourceTable?.fields.find(f => f.id === r.sourceFieldId);
      const targetField = targetTable?.fields.find(f => f.id === r.targetFieldId);

      // Group edges between same nodes to apply different curvature
      const key = [r.sourceTableId, r.targetTableId].sort().join('_');
      const index = counts[key] || 0;
      counts[key] = index + 1;

      // Calculate curvature to avoid overlapping
      // We alternate curvature to spread the lines on both sides
      const baseCurvature = 0.25;
      const step = 0.4;
      const multiplier = Math.floor(index / 2);
      
      // index 0: 0.25, index 1: -0.25, index 2: 0.65, index 3: -0.65 ...
      let curvature = index % 2 === 0 ? baseCurvature + (multiplier * step) : -(baseCurvature + (multiplier * step));
      
      // If there's only one edge between these nodes, we can keep it slightly less curved if it's the first one
      // But actually, spreading them always is safer.

      let label: string = r.type;
      if (sourceField && targetField) {
        if (sourceField.name === targetField.name) {
          label = sourceField.name;
        } else {
          label = `${sourceField.name}/${targetField.name}`;
        }
      }

      return {
        id: r.id,
        source: r.sourceTableId,
        sourceHandle: r.sourceHandleId,
        target: r.targetTableId,
        targetHandle: r.targetHandleId,
        type: 'relation', 
        label: label,
        animated: true,
        data: { curvature },
        style: { stroke: '#38BDF8', strokeWidth: 1.5, strokeDasharray: '4' },
      };
    });
  }, [relations, tables]);

  const onInit = useCallback(() => {
    console.log('Diagram initialized');
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onSelectTable(node.id);
  }, [onSelectTable]);

  const onPaneClick = useCallback(() => {
    onSelectTable(null);
  }, [onSelectTable]);

  return (
    <div className="w-full h-full bg-[#0a0f1c] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        fitView
        colorMode="dark"
      >
        <Controls className="!bg-slate-800 !border-slate-700 !fill-slate-200" />
        <MiniMap className="!bg-slate-900/80 !border-slate-700" nodeColor="#334155" />
        <Background gap={24} size={1} color="#64748b" className="opacity-10" />
        
        <Panel position="top-right" className="flex flex-col gap-2 items-end">
          <button
            onClick={() => setViewMode(v => v === 'all' ? 'summary' : 'all')}
            className="bg-slate-800 text-slate-200 px-4 py-2 rounded-full shadow-2xl hover:bg-slate-700 transition-all flex items-center gap-2 group border border-slate-600/50 whitespace-nowrap"
            title="表示モードの切り替え"
          >
            {viewMode === 'all' ? (
              <><EyeOff size={16} className="text-slate-400 group-hover:text-slate-300" /><span className="font-bold text-[10px] tracking-wider">省略表示</span></>
            ) : (
              <><Eye size={16} className="text-slate-400 group-hover:text-slate-300" /><span className="font-bold text-[10px] tracking-wider">全表示</span></>
            )}
          </button>
          
          <button
            onClick={onAutoLayout}
            className="bg-slate-800 text-slate-200 p-3 rounded-full shadow-2xl hover:bg-slate-700 transition-all flex items-center gap-2 group border border-slate-600/50 whitespace-nowrap mt-2"
            title="AIによる自動整列"
          >
            <Sparkles size={18} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-[10px] uppercase tracking-wider">Auto Layout</span>
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default function Diagram(props: DiagramProps) {
  return (
    <ReactFlowProvider>
      <DiagramInner {...props} />
    </ReactFlowProvider>
  );
}
