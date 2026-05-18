import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Initialize Database (Cloud PostgreSQL or Local SQLite)
let dbType = 'sqlite';
let pgPool = null;
let db = null;

if (process.env.DATABASE_URL) {
  dbType = 'postgres';
  console.log('Connecting to Cloud PostgreSQL...');
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Neon/Supabase SSL connections
  });
  
  pgPool.query(`
    CREATE TABLE IF NOT EXISTS saved_places (
      place_id TEXT PRIMARY KEY,
      name TEXT,
      address TEXT,
      rating TEXT,
      user_ratings_total INTEGER,
      website TEXT,
      analysis_json TEXT,
      status TEXT DEFAULT '未対応',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).then(() => {
    console.log('PostgreSQL table verified/created.');
  }).catch((err) => {
    console.error('Error creating PostgreSQL table', err.message);
  });
} else {
  console.log('Using Local SQLite Database...');
  db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
      console.error('Error opening database', err.message);
    } else {
      db.run(`CREATE TABLE IF NOT EXISTS saved_places (
        place_id TEXT PRIMARY KEY,
        name TEXT,
        address TEXT,
        rating TEXT,
        user_ratings_total INTEGER,
        website TEXT,
        analysis_json TEXT,
        status TEXT DEFAULT '未対応',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    }
  });
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { place } = req.body;
    
    if (!place || !place.name) {
      return res.status(400).json({ error: 'Place data is required' });
    }

    const prompt = `
あなたは優秀なリサーチャー・マーケターです。
以下の店舗情報（Google Mapsデータ）とGoogle検索を活用して、この店舗が「SNS集客支援の営業ターゲット」として適しているかを分析し、スコアリングしてください。

【対象店舗情報】
店舗名: ${place.name}
住所: ${place.formatted_address || '不明'}
評価: ${place.rating || '不明'} (${place.user_ratings_total || 0}件のレビュー)
ビジネスタイプ: ${(place.types || []).join(', ')}
Webサイト: ${place.website || 'なし'}

【分析の必須要件】
1. 経営形態: チェーン・系列店ではなく「個人経営（または小規模店舗）」であるかを判定してください。
2. SNS運用状況の徹底調査: 提供された【Webサイト】の中を探すだけでなく、**必ずAIのGoogle検索機能を使って「site:instagram.com ${place.name} ${place.formatted_address ? place.formatted_address.split(' ')[0] : ''}」というキーワードで検索を実行**し、公式のInstagramアカウントを炙り出してください。TikTokやThreadsについても同様に「site:tiktok.com」「site:threads.net」をつけて検索し、見つかった場合は以下の情報を抽出してください。
   - フォロワー数: 「100以内」「100〜500」「501〜800」「801〜1000」「1001以上」「不明」のいずれか
   - 更新頻度: 「1ヶ月以内」「3ヶ月以内」「6ヶ月以内」「6ヶ月以上放置」「不明」のいずれか

以下のJSON形式のみで回答してください。追加のマークダウンやテキストは不要です。
{
  "score": 0〜100のスコア（個人経営かつSNS運用に課題がある方がスコア高め）,
  "summary": "1行での総評",
  "businessType": "個人経営" または "チェーン・系列店" または "不明",
  "sns": {
    "instagram": { "exists": true/false, "url": "特定したInstagramアカウントのURL（見つからない場合はnull）", "followers": "階層", "update": "頻度階層", "notes": "一言メモ" },
    "threads": { "exists": true/false, "url": "特定したThreadsアカウントのURL（見つからない場合はnull）", "followers": "階層", "update": "頻度階層", "notes": "一言メモ" },
    "tiktok": { "exists": true/false, "url": "特定したTikTokアカウントのURL（見つからない場合はnull）", "followers": "階層", "update": "頻度階層", "notes": "一言メモ" }
  },
  "strengths": ["強み1", "強み2"],
  "weaknesses": ["弱みや営業チャンスになり得る課題1", "課題2"],
  "salesApproach": "どのような提案が刺さりそうかのアドバイス(2-3文)"
}
`;

    // Gemini 2.5 FlashでGoogle検索ツールを有効化してリアルな情報にアクセスしやすくする
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    let resultText = response.text;
    
    // マークダウンのコードブロックが含まれる場合があるため除去
    resultText = resultText.replace(/^```json\n?/m, '').replace(/^```\n?/m, '').trim();
    
    let analysis;
    try {
      analysis = JSON.parse(resultText);
    } catch (e) {
      console.error("JSON parse error:", e);
      console.log("Raw output:", resultText);
      // Fallback
      analysis = {
        score: 50,
        summary: "AIの解析結果をパースできませんでした。",
        strengths: [],
        weaknesses: [],
        salesApproach: resultText
      };
    }

    res.json({ analysis });
  } catch (error) {
    console.error('Error during AI analysis:', error);
    res.status(500).json({ error: 'Failed to analyze place' });
  }
});

// API: 保存済みリストの取得
app.get('/api/saved_places', (req, res) => {
  if (dbType === 'postgres') {
    pgPool.query('SELECT * FROM saved_places ORDER BY created_at DESC', (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      const places = result.rows.map(row => ({
        ...row,
        analysis: row.analysis_json ? JSON.parse(row.analysis_json) : null
      }));
      res.json(places);
    });
  } else {
    db.all('SELECT * FROM saved_places ORDER BY created_at DESC', [], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      const places = rows.map(row => ({
        ...row,
        analysis: row.analysis_json ? JSON.parse(row.analysis_json) : null
      }));
      res.json(places);
    });
  }
});

// API: お気に入り保存 / ステータス更新
app.post('/api/saved_places', (req, res) => {
  const { place_id, name, address, rating, user_ratings_total, website, analysis, status } = req.body;
  const analysis_json = analysis ? JSON.stringify(analysis) : null;

  // Sanitize values to replace 'undefined' with 'null' for PostgreSQL/SQLite compatibility
  const clean_name = name !== undefined ? name : null;
  const clean_address = address !== undefined ? address : null;
  const clean_rating = rating !== undefined ? (rating !== null ? String(rating) : null) : null;
  const clean_user_ratings_total = (user_ratings_total !== undefined && user_ratings_total !== null) ? Number(user_ratings_total) : null;
  const clean_website = website !== undefined ? website : null;

  if (dbType === 'postgres') {
    pgPool.query('SELECT * FROM saved_places WHERE place_id = $1', [place_id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      const row = result.rows[0];

      if (row) {
        const updateStatus = status || row.status;
        const updateAnalysis = analysis_json || row.analysis_json;
        pgPool.query(
          'UPDATE saved_places SET status = $1, analysis_json = $2 WHERE place_id = $3',
          [updateStatus, updateAnalysis, place_id],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, place_id, status: updateStatus });
          }
        );
      } else {
        pgPool.query(
          `INSERT INTO saved_places (place_id, name, address, rating, user_ratings_total, website, analysis_json, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [place_id, clean_name, clean_address, clean_rating, clean_user_ratings_total, clean_website, analysis_json, status || '未対応'],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, place_id, status: status || '未対応' });
          }
        );
      }
    });
  } else {
    db.get('SELECT * FROM saved_places WHERE place_id = ?', [place_id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      if (row) {
        const updateStatus = status || row.status;
        const updateAnalysis = analysis_json || row.analysis_json;
        db.run(
          'UPDATE saved_places SET status = ?, analysis_json = ? WHERE place_id = ?',
          [updateStatus, updateAnalysis, place_id],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, place_id, status: updateStatus });
          }
        );
      } else {
        db.run(
          `INSERT INTO saved_places (place_id, name, address, rating, user_ratings_total, website, analysis_json, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [place_id, clean_name, clean_address, clean_rating, clean_user_ratings_total, clean_website, analysis_json, status || '未対応'],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, place_id, status: status || '未対応' });
          }
        );
      }
    });
  }
});

// API: 保存解除
app.delete('/api/saved_places/:id', (req, res) => {
  if (dbType === 'postgres') {
    pgPool.query('DELETE FROM saved_places WHERE place_id = $1', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  } else {
    db.run('DELETE FROM saved_places WHERE place_id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, deleted: this.changes });
    });
  }
});

// Serve static assets in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
