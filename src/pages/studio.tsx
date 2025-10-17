/**
 * Live2D + VOICEVOX + AI チャットの統合UIコンポーネント
 * 
 * このファイルは、アプリケーションのメインUIを構成し、以下の機能を統合します:
 * 1. Live2Dキャラクターの表示とアニメーション
 * 2. VOICEVOXによる音声合成とリップシンク
 * 3. AIチャット機能（Gemini API経由）
 * 4. 表情制御（感情タグベース）
 * 
 * カスタマイズポイント:
 * - MODEL_URL: 使用するLive2Dモデルのパス
 * - リップシンクパラメータ（Attack, Decay, Gain, Gate）
 * - Speaker ID（VOICEVOXの話者）
 */

import React, { useEffect, useRef, useState } from 'react';
import { playVoiceVox, resumeAudio, stopPlayback } from '../lib/tts';
import { Emotion, parseLeadingEmotionTag, getExpressionCandidates, pickOne } from '../lib/emotion';

// Live2Dモデルファイルのパス
// カスタマイズ: .env.localでNEXT_PUBLIC_SELECTED_LIVE2D_PATHを設定するか、
//              ここのデフォルト値を変更してください
const MODEL_URL =
  process.env.NEXT_PUBLIC_SELECTED_LIVE2D_PATH ||
  'live2d/hijiki/hijiki.model3.json';

/**
 * ブラウザのlocalStorageに状態を永続化するカスタムフック
 * 
 * @param key - localStorageのキー
 * @param initial - 初期値
 * @returns [値, セッター関数] のタプル（useStateと同じインターフェース）
 * 
 * 用途: リップシンクのパラメータや話者IDなど、ユーザー設定を保存
 */
function usePersistentState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);

  // コンポーネントのマウント時にlocalStorageから読み込み
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setV(JSON.parse(raw));
    } catch {}
  }, [key]);

  // 値が変更されたらlocalStorageに保存
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);

  return [v, setV] as const;
}

/**
 * Live2D Cubism Coreライブラリが読み込まれているかチェック
 */
function hasCubismCore(): boolean {
  return typeof (globalThis as any).Live2DCubismCore !== 'undefined';
}

/**
 * Live2D Cubism Coreライブラリを動的に読み込む
 * 
 * public/scripts/live2dcubismcore.min.js を動的に読み込みます。
 * このファイルは必須で、Live2Dモデルを表示するために必要です。
 * 
 * カスタマイズポイント:
 * - スクリプトのパスを変更する場合は s.src を修正
 */
async function ensureCubismCore(): Promise<void> {
  if (hasCubismCore()) return;

  await new Promise<void>((resolve, reject) => {
    const id = 'cubism-core-script';
    if (document.getElementById(id)) {
      setTimeout(() =>
        hasCubismCore() ? resolve() : reject(new Error('CubismCore not ready')), 150
      );
      return;
    }

    const s = document.createElement('script');
    s.id = id;
    s.src = '/scripts/live2dcubismcore.min.js';  // Cubism Coreのパス
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load live2dcubismcore.min.js'));
    document.head.appendChild(s);
  });

  if (!hasCubismCore()) throw new Error('Live2DCubismCore not found after script load');
}

/**
 * Live2Dモデルから口パク用のパラメータIDを自動検出する
 * 
 * @param model - Live2Dモデルインスタンス
 * @returns 口パク用のパラメータID（例: 'ParamMouthOpenY'）
 * 
 * 処理の流れ:
 * 1. モデルの全パラメータIDを取得
 * 2. 優先リストから最初に見つかったものを使用
 * 3. 見つからない場合は正規表現で "mouth" + "open" を検索
 * 4. それでも見つからなければデフォルト値を返す
 * 
 * カスタマイズポイント:
 * - preferred: モデルに合わせて優先パラメータ名を変更
 * - 特定のモデルで固定のパラメータIDを使いたい場合は、直接返り値を指定
 */
function detectMouthParamId(model: any): string {
  const core = model?.internalModel?.coreModel;
  try {
    const count = core?.getParameterCount?.() ?? 0;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = core.getParameterId(i);
      if (id) ids.push(String(id));
    }

    // 優先的に検索するパラメータ名のリスト
    // カスタマイズ: 使用するモデルに合わせて調整してください
    const preferred = ['ParamMouthOpenY', 'MouthOpenY', 'PARAM_MOUTH_OPEN_Y', 'MOUTH_OPEN_Y', 'ParamMouthY'];
    for (const p of preferred) if (ids.includes(p)) return p;

    // パターンマッチで検索: "mouth" かつ "open" を含むパラメータ
    const any = ids.find(id => /mouth/i.test(id) && /open/i.test(id)) || ids.find(id => /mouth/i.test(id));
    return any || 'ParamMouthOpenY';
  } catch {
    return 'ParamMouthOpenY';
  }
}

/**
 * Attack/Decayエンベロープを使った値のスムージング
 * 
 * @param current - 現在の値
 * @param target - 目標値
 * @param attack - 立ち上がり速度（0.0〜1.0、大きいほど速い）
 * @param decay - 減衰速度（0.0〜1.0、大きいほど速い）
 * @returns 次のフレームの値
 * 
 * 用途: 口パクの動きを滑らかにする
 * - Attack: 音声が鳴り始めたときの口の開き方の速さ
 * - Decay: 音が止まったときの口の閉じ方の速さ
 * 
 * カスタマイズポイント:
 * - attack/decayの値を調整することで、キャラクターの口の動きの印象を変更可能
 */
function attackDecayStep(current: number, target: number, attack: number, decay: number) {
  const coeff = target > current ? attack : decay;
  return current + (target - current) * coeff;
}

/**
 * Studio - メインコンポーネント
 * 
 * Live2Dキャラクター、音声合成、AIチャットを統合したUIを提供します。
 */
export default function Studio() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<any>(null);
  const appRef = useRef<any>(null);
  const mouthTargetRef = useRef(0);
  const mouthCurrentRef = useRef(0);
  const mouthIdRef = useRef('ParamMouthOpenY');

  const [speaker, setSpeaker] = usePersistentState<number>('cfg.speaker', 1);
  const [atk, setAtk] = usePersistentState<number>('cfg.mouth.attack', 0.35);
  const [dec, setDec] = usePersistentState<number>('cfg.mouth.decay', 0.18);
  const [gain, setGain] = usePersistentState<number>('cfg.mouth.gain', 1.8);
  const [gate, setGate] = usePersistentState<number>('cfg.mouth.gate', 0.04);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [subtitle, setSubtitle] = useState('');

  useEffect(() => {
    let disposed = false;

    (async () => {
      if (!stageRef.current) return;

      await ensureCubismCore();

      const PIXI: any = await import('pixi.js');
      let Live2DModel: any = null;

      try {
        Live2DModel = (await import('pixi-live2d-display-lipsyncpatch/cubism4')).Live2DModel;
        setLogs(p => [...p, '✅ using lipsyncpatch / cubism4']);
      } catch {
        const m: any = await import('pixi-live2d-display-lipsyncpatch');
        Live2DModel = m.Live2DModel || m.Live2DModel4;
        setLogs(p => [...p, '⚠ fallback build']);
      }

      if (!Live2DModel) throw new Error('Live2DModel not found');

      (window as any).PIXI = PIXI;
      const app = new PIXI.Application({ resizeTo: stageRef.current, backgroundColor: 0xf5f7fb, antialias: true });
      if (disposed) { app.destroy(true); return; }
      appRef.current = app;
      stageRef.current.appendChild(app.view as HTMLCanvasElement);

      const model = await Live2DModel.from(MODEL_URL);
      if (disposed) { model.destroy(); app.destroy(true); return; }
      modelRef.current = model;
      app.stage.addChild(model);

      const fit = () => {
        const cw = app.renderer.width, ch = app.renderer.height;
        const b = model.getLocalBounds?.() || { width: model.width, height: model.height };
        const mw = b.width || model.width || 1, mh = b.height || model.height || 1;
        const s = Math.max(0.1, Math.min((cw * 0.9) / mw, (ch * 0.9) / mh));
        model.scale.set(s);
        model.x = (cw - model.width) / 2;
        model.y = (ch - model.height) / 2;
      };

      try {
        await new Promise<void>(r => {
          model.once?.('modelLoaded', () => r());
          model.once?.('ready', () => r());
          setTimeout(() => r(), 800);
        });
      } catch {}

      fit();
      app.renderer.on('resize', fit);

      mouthIdRef.current = detectMouthParamId(model);
      setLogs(p => [...p, `🔎 mouth id = ${mouthIdRef.current}`]);

      const ticker = app.ticker;
      const tick = () => {
        mouthCurrentRef.current = attackDecayStep(mouthCurrentRef.current, mouthTargetRef.current, atk, dec);
        let v = mouthCurrentRef.current;
        if (v < gate) v = 0;
        v = Math.max(0, Math.min(1, v * gain));
        const core = model?.internalModel?.coreModel;
        try {
          const idx = core.getParameterIndex?.(mouthIdRef.current) ?? -1;
          if (idx >= 0 && typeof core.setParameterValue === 'function') {
            const min = core.getParameterMinimumValue?.(idx) ?? 0;
            const max = core.getParameterMaximumValue?.(idx) ?? 1;
            core.setParameterValue(idx, min + (max - min) * v);
          } else if (typeof core.setParameterValueById === 'function') {
            core.setParameterValueById(mouthIdRef.current, v);
          }
        } catch {}
      };
      ticker.add(tick);

      setLogs(p => [...p, '✅ Live2D loaded']);
    })().catch(e => setLogs(p => [...p, `Init error: ${e?.message ?? e}`]));

    return () => {
      disposed = true;
      try { stopPlayback(); } catch {}
      try { appRef.current?.destroy(true); } catch {}
    };
  }, [atk, dec, gain, gate]);

  function applyExpressionByEmotion(emotion: Emotion) {
    const model = modelRef.current;
    if (!model) return;

    const candidates = getExpressionCandidates();
    const names = candidates[emotion] || [];
    if (!names.length) return;

    const name = pickOne(names);
    try {
      if (name && typeof model.expression === 'function') {
        model.expression(name);
        setLogs((p) => [...p, `🙂 expression: ${emotion} → ${name}`]);
      }
    } catch (e: any) {
      setLogs((p) => [...p, `expression error: ${e?.message ?? e}`]);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (busy) return;
    setBusy(true);

    const userText = text || 'こんにちは';
    setLogs(p => [...p, `You: ${userText}`]);
    setInput('');
    setSubtitle('');

    try {
      await resumeAudio();

      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: userText }),
      });

      if (!r.ok) throw new Error(`chat api ${r.status}`);
      const j = await r.json();
      const answer: string = j.message || 'うーん…わかりません';

      setSubtitle(answer);

      const { emotion, stripped } = parseLeadingEmotionTag(answer);
      applyExpressionByEmotion(emotion);

      await playVoiceVox((stripped || answer), speaker, (lv) => (mouthTargetRef.current = lv));
      setLogs(p => [...p, `Agent: ${answer}`]);
    } catch (e: any) {
      setLogs(p => [...p, `Error: ${e?.message ?? e}`]);
    } finally {
      setBusy(false);
      setTimeout(() => setSubtitle(''), 4000);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', height: '100vh', fontFamily: 'ui-sans-serif,system-ui' }}>
      <div ref={stageRef} style={{ position: 'relative', background: '#f5f7fb' }}>
        <div style={{
          position: 'absolute',
          left: 12,
          top: 12,
          background: 'rgba(0,0,0,.55)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 14,
          maxWidth: '60%'
        }}>
          {subtitle || '…'}
        </div>
      </div>

      <div style={{ borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label>Speaker</label>
            <input type="number" min={1} value={speaker}
              onChange={e => setSpeaker(parseInt(e.target.value || '1', 10))}
              style={{ width: '100%' }}
            />
          </div>
          <button
            onClick={() => playVoiceVox('テストです', speaker, (lv) => (mouthTargetRef.current = lv))}
            style={{ alignSelf: 'end', padding: '8px 12px' }}
          >
            🔊 テスト再生
          </button>
        </div>

        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          <label>Attack<input type="range" min={0.01} max={0.8} step={0.01} value={atk} onChange={e => setAtk(parseFloat(e.target.value))} /></label>
          <label>Decay<input type="range" min={0.01} max={0.8} step={0.01} value={dec} onChange={e => setDec(parseFloat(e.target.value))} /></label>
          <label>Gain<input type="range" min={0.5} max={3.0} step={0.05} value={gain} onChange={e => setGain(parseFloat(e.target.value))} /></label>
          <label>Gate<input type="range" min={0.0} max={0.2} step={0.005} value={gate} onChange={e => setGate(parseFloat(e.target.value))} /></label>
        </div>

        <div style={{ padding: 12, display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="メッセージを入力..."
            style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}
          />
          <button
            onClick={handleSend}
            disabled={busy}
            style={{ padding: '10px 16px', borderRadius: 8, background: busy ? '#9ca3af' : '#111827', color: '#fff' }}
          >
            送信
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 12, fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}
