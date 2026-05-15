import { GoogleGenAI } from "@google/genai";
import { Project } from "./types";

function getAIClient(customKey?: string) {
  const apiKey = customKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please set it in Settings or environment variables.");
  }
  return new GoogleGenAI({ apiKey });
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
