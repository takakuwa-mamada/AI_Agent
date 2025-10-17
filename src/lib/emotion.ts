/**
 * 感情タグの解析と表情マッピング
 * 
 * このファイルは、AIからの返答テキストに含まれる感情タグを解析し、
 * Live2Dモデルの表情（expression）に変換する機能を提供します。
 * 
 * 使用例：
 * - AIが "[happy] こんにちは！" と返答
 * - parseLeadingEmotionTag で "happy" を抽出
 * - getExpressionCandidates で対応する表情名（smile, joyなど）を取得
 * - Live2Dモデルに表情を適用
 */

// サポートする感情の種類を定義
// カスタマイズ: 新しい感情を追加する場合は、ここに追加してください
export type Emotion = 'neutral' | 'happy' | 'excited' | 'serious' | 'sad' | 'angry';

// テキストの先頭にある感情タグを検出する正規表現（例: [happy], [sad]）
const TAG_PATTERN = /^\s*\[([a-z_]+)\]\s*/i;

/**
 * テキストの先頭から感情タグを抽出する
 * 
 * @param text - AIからの返答テキスト（例: "[happy] こんにちは！"）
 * @returns 感情タイプとタグを除去したテキスト
 * 
 * カスタマイズポイント:
 * - タグのフォーマットを変更する場合は TAG_PATTERN を修正
 * - 新しい感情タグを追加する場合は map に追加
 */
export function parseLeadingEmotionTag(text: string): { emotion: Emotion; stripped: string } {
  const m = text.match(TAG_PATTERN);
  if (!m) return { emotion: 'neutral', stripped: text };
  
  const tag = m[1].toLowerCase();
  
  // タグ名から感情タイプへのマッピング
  // カスタマイズ: 新しいタグ名や別名を追加できます
  const map: Record<string, Emotion> = {
    neutral: 'neutral',
    happy: 'happy',
    excited: 'excited',
    joy: 'happy',      // 別名: joy → happy にマッピング
    serious: 'serious',
    sad: 'sad',
    angry: 'angry',
  };
  
  return { 
    emotion: map[tag] ?? 'neutral',           // マッピングに存在しない場合は neutral
    stripped: text.replace(TAG_PATTERN, '')   // タグを除去したテキスト
  };
}

/**
 * 各感情に対応するLive2D表情名のリストを返す
 * 
 * @returns 感情ごとの表情名の配列
 * 
 * カスタマイズポイント:
 * - 使用するLive2Dモデルの表情名に合わせて調整してください
 * - モデルの .model3.json を確認して、実際に存在する表情名を指定します
 * - 例: hijikiモデルの場合は ['f01', 'f02'] など
 */
export function getExpressionCandidates(): Record<Emotion, string[]> {
  return {
    neutral: [],                            // neutralの場合は表情を変更しない
    happy: ['smile', 'joy', 'smiley'],     // 嬉しい・楽しい表情
    excited: ['excited', 'smile'],         // 興奮・はしゃいでいる表情
    serious: ['serious', 'neutral'],       // 真面目・真剣な表情
    sad: ['sad'],                          // 悲しい表情
    angry: ['angry'],                      // 怒り・不機嫌な表情
  };
}

/**
 * 配列からランダムに1つ選択する
 * 
 * @param arr - 選択肢の配列
 * @returns ランダムに選ばれた要素（配列が空の場合は空文字列）
 * 
 * 用途: 複数の表情候補からランダムに1つ選ぶことで、表情のバリエーションを増やす
 */
export function pickOne(arr?: string[]) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}
