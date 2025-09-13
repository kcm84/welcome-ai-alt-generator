import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";
import { OpenAI } from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });
// 프론트 도메인으로 교체
const FRONT_ORIGIN = "https://welcome-ai-alt-generator-frontend.onrender.com";

app.use(cors({
  origin: FRONT_ORIGIN,
  methods: ["POST"],
}));
app.use(express.json());

// Hugging Face Access Token (Render 환경 변수에 설정 필요)
// Render에서는 OPENAI_API_KEY로 등록하세요.
const HF_TOKEN = process.env.OPENAI_API_KEY;

// Hugging Face Router OpenAI 호환 클라이언트 생성
const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: HF_TOKEN,
});

// Alt tag 자동 분류 프롬프트
const basePrompt = `
당신은 멀티모달 AI 입니다. 주어진 이미지를 분석해 웹 접근성과 SEO에 유용한 Alt tag(대체 텍스트)를 한 줄로 생성하세요.

[목표]
- Alt tag에 이미지 안에 포함된 **모든 텍스트**를 가능한 한 원문 그대로 포함한다.
- 텍스트뿐 아니라 장면 설명도 결합하여, 이미지의 전체 의미를 이해할 수 있도록 한다.
- 추측/과장은 하지 않는다. 실제 보이는 정보만 사용한다.

[작업 순서]
1) OCR 단계:
   - 이미지에 보이는 모든 텍스트(간판, 배너, 표, 그래프, 캡션, 문서 내용 등)를 가능한 정확히 추출한다.
   - 영어/숫자/특수기호 포함 그대로 보존한다.
   - 긴 문장은 줄이지 말고 그대로 포함한다. (단, Alt tag는 한 줄이어야 함 → 중간에 ‘·’ 또는 ‘, ’로 연결)

2) 장면 설명 결합:
   - 텍스트 외에 눈에 보이는 장면, 배경, 그래프, 레이아웃 등을 요약해서 함께 포함한다.
   - 예: “간판에 ‘WELCOME BANK’ 문구가 적힌 건물 외관, 유리 파사드 앞에 보행자가 서 있는 장면”

3) 출력 규칙:
   - 한국어, 한 줄 문장
   - “이미지/사진/그림” 같은 메타 단어 금지
   - 문장 끝은 마침표로 마무리
   - 줄바꿈·따옴표·이모지 사용 금지

[출력 형식]
- Alt tag 한 줄만 출력 (따옴표 없이)
- OCR 텍스트가 많을 경우 → ‘·’ 또는 ‘, ’로 연결하여 모두 포함
- 장면 설명은 OCR 텍스트 뒤에 짧게 덧붙여 한 문장으로 결합

[예시]
- “간판에 ‘WELCOME BANK’, ‘24시간 영업’ 문구가 적혀 있고 붉은 간판 아래 유리문 출입구가 보이는 건물 외관.”
- “포스터 상단에 ‘2024 금융 세미나 안내’, 하단에 ‘장소: 서울 코엑스 · 시간: 오후 2시’ 문구가 적혀 있으며 배경에는 회의실 일러스트가 함께 배치된 장면.”
`;

// Alt tag 생성 함수
async function generateAltTag(imagePath) {
  try {
    // 이미지 크기 줄이기 (512px 폭, JPEG 변환)
    const resizedBuffer = await sharp(imagePath)
      .resize({ width: 512, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Base64 Data URI 변환
    const base64Image = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;

    // Hugging Face Router 호출
    const chatCompletion = await client.chat.completions.create({
      model: "Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic",
      messages: [
        {
          role: "system",
          content: basePrompt,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "이 이미지에 맞는 Alt tag를 생성해 주세요." },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
    });

    return chatCompletion.choices[0].message.content || "Alt tag 생성 실패";
  } catch (error) {
    console.error(
      "⚠️ Hugging Face Router API 호출 에러:",
      error.response?.status,
      error.response?.data || error.message
    );
    return "Alt tag 생성 중 오류 발생";
  }
}

// 헬스체크 라우트
app.get("/", (req, res) => {
  res.send("✅ Welcome AI Alt Generator backend is running (with OCR/Caption logic + Sharp resize)");
});

// Alt tag 생성 API
app.post("/api/generate-alt", upload.single("image"), async (req, res) => {
  try {
    const altTag = await generateAltTag(req.file.path);
    fs.unlinkSync(req.file.path); // 임시 파일 삭제
    res.json({ altTag });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Alt tag 생성 실패" });
  }
});

// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));