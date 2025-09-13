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
당신은 Alt tag 생성 AI입니다.
다음 규칙에 따라 이미지를 분석하고 Alt tag를 작성하세요.

규칙:
1. 이미지 안의 텍스트를 모두 빠짐없이 추출하세요.
   - 줄 단위로 그대로 출력합니다. (줄바꿈 유지)
   - 숫자, 단위(%·원·개월 등), 상품명, 회사명 등은 반드시 원문 그대로 보존하세요.

2. 이미지가 텍스트만 포함하는 경우:
   - 모든 텍스트를 줄 단위로 그대로 Alt tag로 출력하세요.

3. 이미지가 텍스트와 장면을 함께 포함하는 경우:
   - 먼저 모든 텍스트를 줄 단위로 출력한 뒤,
   - 마지막 줄에 "장면 설명: …" 형식으로 배경이나 상황을 설명하세요.

4. 이미지가 표(Table)나 문서(Document) 형식인 경우:
   - 행(Row) 단위로 읽어서 줄바꿈으로 구분하세요.
   - 셀(Cell) 구분은 "│" 또는 "," 로 표시할 수 있습니다.
   - 문서는 문단 단위로 구분해 최대한 원문 형식에 가깝게 유지하세요.

5. 이미지에 텍스트가 전혀 없는 경우:
   - "장면 설명: …" 형식으로만 출력하세요.

6. 최종 Alt tag는:
   - 시각장애인 사용자가 스크린 리더로 듣더라도 내용을 충분히 이해할 수 있어야 합니다.
   - 금융 사이트의 특성을 고려해 금리, 상품명, 기간, 이벤트 내용 등 중요한 정보를 반드시 포함하세요.
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