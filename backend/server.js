import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { OpenAI } from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());

// Hugging Face Access Token (환경 변수에서 가져오기)
const HF_TOKEN = process.env.HUGGING_FACE_API_KEY;

// Hugging Face Router OpenAI 호환 클라이언트 생성
const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: HF_TOKEN,
});

// Alt tag 생성 함수
async function generateAltTag(imagePath) {
  try {
    // 업로드된 파일을 public URL 대신 base64로 읽어 전달
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

    const chatCompletion = await client.chat.completions.create({
      // 모델 이름 + provider (hyperbolic) 지정
      model: "Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image in one short alt-text sentence (Korean if possible)." },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
    });

    return chatCompletion.choices[0].message.content || "Alt tag 생성 실패";
  } catch (error) {
    console.error("Hugging Face Router API 호출 에러:", error.response?.status, error.response?.data || error.message);
    return "Alt tag 생성 중 오류 발생";
  }
}

// 헬스체크 라우트
app.get("/", (req, res) => {
  res.send("✅ Welcome AI Alt Generator backend is running (using Hugging Face Router)");
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