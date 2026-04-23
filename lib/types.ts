export type DBType = string;

export interface DBTypeOption {
  id: string;
  name: string;
}

export interface DBEnvironment {
  id: string;
  name: string;
  version: string;
  defaultTypes: { name: string; defaultLength: string }[];
}

export interface AppSettings {
  initialView: 'design' | 'specification' | 'preview';
  dbTypes: DBTypeOption[];
  dbEnvironments: DBEnvironment[];
  selectedEnvironmentId: string;
  geminiApiKey: string;
}

export interface Field {
  id: string;
  name: string;
  type: string;
  length: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  notes: string;
}

export interface Table {
  id: string;
  name: string;
  description: string;
  fields: Field[];
  position: { x: number; y: number };
}

export interface Relation {
  id: string;
  sourceTableId: string;
  sourceFieldId: string;
  sourceHandleId?: string;
  targetTableId: string;
  targetFieldId: string;
  targetHandleId?: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface Project {
  id: string;
  name: string;
  dbName: string;
  description: string;
  dbType: DBType;
  language: string;
  environmentId?: string;
  context: string;
  constraints: string;
  tables: Table[];
  relations: Relation[];
  createdAt: number;
  updatedAt: number;
}
