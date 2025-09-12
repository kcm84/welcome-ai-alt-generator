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
          role: "user",
          content: [
            {
              type: "text",
              text:
                "당신은 OCR + 이미지 설명 전문가입니다.\n" +
                "이 이미지에 포함된 모든 글자를 추출하고, 글자가 없으면 장면을 설명하여 100자 내외 Alt tag를 만들어 주세요."
            },
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