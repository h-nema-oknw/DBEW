import { GoogleGenAI } from "@google/genai";
import { Project } from "./types";

export type ApiKeyValidationResult = {
  valid: boolean;
  message: string;
  hint?: string;
  rawError?: string;
};

function getAIClient(customKey?: string) {
  const apiKey = customKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please set it in Settings or environment variables.");
  }
  return new GoogleGenAI({ apiKey });
}

export async function validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
  if (!apiKey.trim()) {
    return {
      valid: false,
      message: 'APIキーを入力してください。',
      hint: 'Google AI Studio (https://aistudio.google.com/app/apikey) でAPIキーを取得できます。',
    };
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  try {
    await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: "1" }] }],
    });
    return { valid: true, message: 'APIキーは正常に使用できます。' };
  } catch (error: any) {
    const status: number | undefined = error?.status ?? error?.httpStatus;
    const raw: string = error?.message || String(error);

    if (status === 400 || raw.includes('API_KEY_INVALID') || raw.includes('INVALID_ARGUMENT')) {
      return {
        valid: false,
        message: 'APIキーが無効です。',
        hint: 'キーのコピー漏れや余分なスペースがないか確認してください。Google AI Studioで新しいキーを発行することも有効です。',
        rawError: raw,
      };
    }

    if (status === 403 || raw.includes('PERMISSION_DENIED')) {
      return {
        valid: false,
        message: 'このAPIキーにはGemini APIへのアクセス権がありません。',
        hint: 'Google AI StudioでGemini APIが有効化されているか確認してください。プロジェクトのAPI制限設定も確認してください。',
        rawError: raw,
      };
    }

    if (status === 429 || raw.includes('RESOURCE_EXHAUSTED')) {
      return {
        valid: true,
        message: 'APIキーは有効ですが、現在レート制限（quota超過）に達しています。',
        hint: 'しばらく時間をおいてから再試行してください。Google AI Studioで使用量とQuotaを確認してください。',
        rawError: raw,
      };
    }

    if (status === 503 || status === 500 || raw.includes('SERVICE_UNAVAILABLE')) {
      return {
        valid: false,
        message: 'Google Gemini サービスが現在利用できません。',
        hint: 'Googleのサービス障害の可能性があります。しばらく待ってから再試行してください。',
        rawError: raw,
      };
    }

    if (raw.toLowerCase().includes('fetch') || raw.toLowerCase().includes('network') || raw.toLowerCase().includes('enotfound')) {
      return {
        valid: false,
        message: 'ネットワークエラーが発生しました。',
        hint: 'インターネット接続を確認してください。プロキシやファイアウォールがGoogle APIへのアクセスをブロックしていないか確認してください。',
        rawError: raw,
      };
    }

    return {
      valid: false,
      message: '検証中に予期しないエラーが発生しました。',
      hint: '時間をおいて再試行してください。問題が続く場合はAPIキーを再発行してください。',
      rawError: raw,
    };
  }
}

export function parseStructuredData(text: string): Partial<Project> | null {
  const trimmed = text.trim();
  
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return { tables: parsed };
      } else if (parsed.tables || parsed.name) {
        return parsed;
      }
    } catch(e) { }
  }

  // Check if it looks like CSV
  if (trimmed.includes(',') && trimmed.split('\n').length > 1) {
    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    const tablesMap = new Map<string, any>();
    
    // Check if the file has typical table headers
    if (trimmed.includes('テーブル') || trimmed.includes('カラム') || lines.length > 1) {
      lines.forEach((line, i) => {
        if (i === 0 && (line.includes('テーブル') || line.toLowerCase().includes('table'))) return;
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 3) return; // At least Table, Field, Type
        
        const tableName = cols[0];
        if (!tableName) return;
        
        const tableDesc = cols.length > 8 ? cols[1] : '';
        const offset = cols.length > 8 ? 1 : 0; // if description is present

        const fieldName = cols[1 + offset];
        const fieldType = cols[2 + offset];
        const fieldLength = cols[3 + offset] || '';
        
        const isPK = /^(1|true|y|yes|pk|〇)/i.test(cols[4 + offset] || '');
        const isNullable = /^(1|true|y|yes|null|〇)/i.test(cols[5 + offset] || '');
        const isFK = /^(1|true|y|yes|fk|〇)/i.test(cols[6 + offset] || '');
        const notes = cols[7 + offset] || '';

        if (!tablesMap.has(tableName)) {
          tablesMap.set(tableName, {
            name: tableName,
            description: tableDesc,
            fields: []
          });
        }

        if (fieldName && fieldType) {
          tablesMap.get(tableName)!.fields.push({
            name: fieldName,
            type: fieldType,
            length: fieldLength,
            isPrimaryKey: isPK,
            isNullable: isNullable,
            isForeignKey: isFK,
            notes: notes
          });
        }
      });
      if (tablesMap.size > 0) {
        return { tables: Array.from(tablesMap.values()) };
      }
    }
  }

  return null;
}

export async function analyzeMarkdown(markdown: string, apiKey?: string): Promise<Partial<Project>> {
  const ai = getAIClient(apiKey);
  const prompt = `
    以下のMarkdownデータベース仕様書を分析し、デザインを抽出してください。
    出力形式: Projectオブジェクトを表すJSON。
    
    Markdown:
    ${markdown}
    
    【重要】出力は純粋なJSONオブジェクトのみを返してください（markdownのコードブロック記法 \`\`\`json などは含めないでください）。
    構造:
    {
      "name": "プロジェクト名",
      "dbName": "データベース物理名",
      "description": "プロジェクトの説明",
      "dbType": "Relational" | "Hierarchical" | "Network",
      "language": "SQL / その他",
      "context": "MDからのコンテキスト",
      "constraints": "制約事項",
      "tables": [
        {
          "name": "テーブル名",
          "description": "概要",
          "fields": [
            { "name": "フィールド名", "type": "型", "length": "長さ", "isPrimaryKey": true, "isForeignKey": false, "isNullable": false, "notes": "備考" }
          ]
        }
      ],
      "relations": [
        { "sourceTableName": "ソーステーブル", "sourceFieldName": "カラム名", "targetTableName": "ターゲットテーブル", "targetFieldName": "カラム名", "type": "one-to-many" }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    const text = response.text || "{}";
    // Clean potential markdown artifacts
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw error;
  }
}

export function generateMarkdown(project: Project): string {
  const e = (text?: string) => text ? text.replace(/_/g, '\\_') : '';

  let md = `# データベース仕様書: ${e(project.name)}\n\n`;
  md += `**データベース名:** ${e(project.dbName)}\n`;
  md += `**説明:** ${e(project.description)}\n`;
  md += `**DB種別:** ${e(project.dbType)}\n`;
  md += `**言語/環境:** ${e(project.language)}\n\n`;
  md += `## 設計コンテキスト\n${e(project.context)}\n\n`;
  md += `## 制約事項\n${e(project.constraints)}\n\n`;
  
  md += `## ER図 (Mermaid)\n\n\`\`\`mermaid\nerDiagram\n`;
  project.relations.forEach(rel => {
    const sourceTable = project.tables.find(t => t.id === rel.sourceTableId);
    const targetTable = project.tables.find(t => t.id === rel.targetTableId);
    if (sourceTable && targetTable) {
      const arrow = rel.type === 'one-to-many' ? '||--|{' : 
                    rel.type === 'one-to-one' ? '||--||' : '}|--|{';
      md += `    ${sourceTable.name.replace(/\s+/g, '_')} ${arrow} ${targetTable.name.replace(/\s+/g, '_')} : "関連"\n`;
    }
  });
  md += `\`\`\`\n\n`;

  md += `## テーブル定義\n\n`;
  project.tables.forEach(table => {
    md += `### ${e(table.name)}\n`;
    md += `${e(table.description)}\n\n`;
    md += `| フィールド名 | データ型 | 長さ/精度 | PK | FK | NULL許可 | 備考 |\n`;
    md += `|--------------|----------|-----------|----|----|----------|------|\n`;
    table.fields.forEach(f => {
      md += `| ${e(f.name)} | ${e(f.type)} | ${e(f.length)} | ${f.isPrimaryKey ? 'Yes' : ''} | ${f.isForeignKey ? 'Yes' : ''} | ${f.isNullable ? 'Yes' : 'No'} | ${e(f.notes)} |\n`;
    });
    md += `\n`;
  });

  return md;
}

export async function layoutTables(project: Project, apiKey?: string): Promise<Record<string, { x: number; y: number }>> {
  const ai = getAIClient(apiKey);
  const prompt = `
    以下のデータベース構造（テーブルとリレーション）を分析し、ER図として見やすい最適な座標（x, y）を決定してください。
    関連性の強いテーブルは近くに配置し、全体としてバランスの良いレイアウトにしてください。

    【制約事項】
    1. テーブル同士の重なりを厳禁とします。中心点の間隔は横方向に少なくとも300px以上、縦方向に250px以上の距離を保ってください。
    2. リレーション（矢印）が極力交差しないように配置してください。
    3. 親テーブルを上部、子テーブルを下部または右側に配置するような階層的な流れ（Mermaid.jsの基本レイアウトのような構成）を意識してください。
    4. 座標(x, y)は 0〜1500 の範囲で算出してください。
    
    テーブル一覧（IDと名称）:
    ${JSON.stringify(project.tables.map(t => ({ id: t.id, name: t.name })), null, 2)}
    
    リレーション一覧:
    ${JSON.stringify(project.relations.map(r => ({ from: r.sourceTableId, to: r.targetTableId })), null, 2)}
    
    出力形式: { "テーブルID": { "x": 数値, "y": 数値 } } のJSONのみを返してください。
    【重要】x, yは前述の通り 0〜1500 程度の範囲で指定してください。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    const text = response.text || "{}";
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("AI Layout failed:", error);
    // Fallback: Simple grid layout
    const layout: Record<string, { x: number; y: number }> = {};
    project.tables.forEach((t, i) => {
      layout[t.id] = { x: (i % 3) * 350, y: Math.floor(i / 3) * 300 };
    });
    return layout;
  }
}
