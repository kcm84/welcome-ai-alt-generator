import stringSimilarity from "string-similarity";

// 교정 사전 (원하는 단어들을 자유롭게 추가 가능)
const dictionary = [
  "웰컴저축은행",
  "웰컴금융그룹",
  "웰컴디지털뱅크"
];

/**
 * 텍스트 교정 함수
 * @param {string} text - 인식된 텍스트
 * @returns {string} - 교정된 텍스트 (없으면 원본 반환)
 */
export function correctText(text) {
  const { bestMatch } = stringSimilarity.findBestMatch(text, dictionary);

  // 유사도가 0.7 이상이면 교정
  if (bestMatch.rating >= 0.7) {
    return bestMatch.target;
  }
  return text;
}