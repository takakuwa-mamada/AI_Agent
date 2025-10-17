/**
 * 音声合成（VOICEVOX）とリップシンク制御
 * 
 * このファイルは、VOICEVOXを使った音声合成と、
 * 音声の波形を解析してLive2Dキャラクターの口パクを制御する機能を提供します。
 * 
 * 主な機能:
 * 1. VOICEVOX APIを使ってテキストを音声に変換
 * 2. 音声の音量レベルをリアルタイムで解析
 * 3. 口パクのレベル（0.0〜1.0）をコールバックで返す
 */

// Web Audio APIの各種ノードを保持するグローバル変数
let audioCtx: AudioContext | null = null;           // オーディオコンテキスト（音声処理の基盤）
let currentSource: AudioBufferSourceNode | null = null;  // 現在再生中の音声ソース
let currentGain: GainNode | null = null;            // 音量調整ノード
let analyser: AnalyserNode | null = null;           // 音声解析ノード（口パク用）
let rafId: number | null = null;                    // requestAnimationFrameのID

/**
 * オーディオコンテキストを初期化・再開する
 * 
 * ブラウザのセキュリティ制約により、ユーザーのインタラクション後に
 * AudioContextを初期化・再開する必要があります。
 * 
 * カスタマイズポイント:
 * - 通常は変更不要ですが、別の音声ライブラリを使う場合は修正が必要
 */
export async function resumeAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
}

/**
 * 現在再生中の音声を停止し、リソースをクリーンアップする
 * 
 * 用途:
 * - 新しい音声を再生する前に、前の音声を停止
 * - コンポーネントのアンマウント時にリソースを解放
 */
export function stopPlayback() {
  try { currentSource?.stop(); } catch {}
  try { currentSource?.disconnect(); } catch {}
  try { currentGain?.disconnect(); } catch {}
  try { analyser?.disconnect(); } catch {}
  currentSource = null;
  currentGain = null;
  analyser = null;
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
}

/**
 * VOICEVOXでテキストを音声合成し、リップシンク付きで再生する
 * 
 * @param text - 読み上げるテキスト
 * @param speaker - VOICEVOXの話者ID（1=四国めたん（ノーマル）、3=ずんだもんなど）
 * @param mouthLevelCallback - 口パクレベル（0.0〜1.0）を受け取るコールバック関数
 * 
 * 処理の流れ:
 * 1. VOICEVOXのAPIエンドポイント（/api/voicevox/tts）にリクエスト
 * 2. 返ってきたWAVファイルをデコードして再生
 * 3. 音声の波形をリアルタイムで解析
 * 4. RMS（二乗平均平方根）を計算して口パクレベルに変換
 * 5. コールバック関数を通じてLive2Dに口パクレベルを渡す
 * 
 * カスタマイズポイント:
 * - speaker: VOICEVOXの話者を変更（数値はVOICEVOXのドキュメント参照）
 * - rms * 3: 口パク感度の調整（大きくすると口が大きく開く）
 * - an.fftSize: 音声解析の精度（1024が標準、小さいと処理が軽い）
 */
export async function playVoiceVox(
  text: string,
  speaker: number,
  mouthLevelCallback?: (level01: number) => void,
) {
  // オーディオコンテキストを準備
  await resumeAudio();
  // 前の音声が再生中なら停止
  stopPlayback();

  // VOICEVOX APIに音声合成をリクエスト
  const res = await fetch('/api/voicevox/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speaker }),
  });
  
  if (!res.ok) {
    let msg = '';
    try { msg = await res.text(); } catch {}
    throw new Error(`VOICEVOX TTS failed: ${res.status} ${msg}`);
  }
  
  // WAVファイルをArrayBufferとして取得
  const arr = await res.arrayBuffer();
  // オーディオデータにデコード
  const buf = await audioCtx!.decodeAudioData(arr.slice(0));
  
  // Web Audio APIのノードを作成
  const src = audioCtx!.createBufferSource();    // 音声ソース
  const gain = audioCtx!.createGain();           // ゲイン（音量調整）
  const an = audioCtx!.createAnalyser();         // アナライザー（波形解析）
  an.fftSize = 1024;  // FFTサイズ（解析精度、カスタマイズ可能）

  // ノードを接続: ソース → ゲイン → アナライザー → スピーカー
  src.buffer = buf;
  src.connect(gain);
  gain.connect(an);
  an.connect(audioCtx!.destination);

  // グローバル変数に保存（停止時に使用）
  currentSource = src;
  currentGain = gain;
  analyser = an;

  // 音声波形データを格納する配列
  const data = new Uint8Array(analyser.frequencyBinCount);
  
  /**
   * リアルタイムで音声レベルを解析するループ
   * 
   * 処理内容:
   * 1. 波形データを取得（0〜255の整数値）
   * 2. RMS（Root Mean Square）を計算: 音量の実効値
   * 3. 0.0〜1.0の範囲に正規化
   * 4. コールバック関数で口パクレベルを通知
   */
  const loop = () => {
    if (!analyser) return;
    
    // 時間領域の波形データを取得（音声の波形そのもの）
    analyser.getByteTimeDomainData(data);
    
    // RMS計算: 音声の実効値（音量の大きさ）を算出
    // (値 - 128) / 128 で -1.0〜1.0 に正規化し、二乗して平均を取る
    const mean = data.reduce((s, v) => s + Math.pow((v - 128) / 128, 2), 0) / data.length;
    const rms = Math.sqrt(mean);
    
    // 口パクレベルをコールバックで通知
    // rms * 3 は感度調整（カスタマイズ可能）
    if (mouthLevelCallback) mouthLevelCallback(Math.min(1, Math.max(0, rms * 3)));
    
    // 次のフレームでも実行（アニメーションループ）
    rafId = requestAnimationFrame(loop);
  };
  loop();

  // 音声の再生を開始し、終了を待つ
  await new Promise<void>((resolve, reject) => {
    src.onended = () => resolve();
    try { src.start(0); } catch (e) { reject(e); }
  });

  // 再生終了後、リソースをクリーンアップ
  stopPlayback();
}
