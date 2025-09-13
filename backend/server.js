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
- 이미지 안의 텍스트를 전부 빠짐없이 추출하여 Alt tag에 포함시키세요.
- 여러 문구는 줄바꿈으로 모두 포함시키세요.
- 이미지에 텍스트만 있다면 전체 텍스트를 Alt tag로 출력하세요.
- 이미지가 텍스트와 장면을 함께 포함한다면, 텍스트 + 장면 설명을 모두 포함하세요.
- 최종 결과는 Alt tag 용도로 자연스럽게 작성하세요.
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