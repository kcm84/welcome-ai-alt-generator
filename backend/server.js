import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";
import fetch from "node-fetch";
import { OpenAI } from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());

// Hugging Face API 토큰 (한 개만 발급받아서 두 곳에 공용으로 사용 가능)
const HF_TOKEN = process.env.HF_TOKEN;
const OPENAI_API_KEY = process.env.HF_TOKEN;

// Hugging Face Router (Qwen 멀티모달 호출)
const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: OPENAI_API_KEY, // 같은 키 재사용
});

// -------------------------
// Hugging Face OCR: ko-trocr-base-nsmc-news-chatbot
// -------------------------
async function runKoTrOCR(imagePath) {
  const imageBytes = fs.readFileSync(imagePath);

  const response = await fetch(
    "https://api-inference.huggingface.co/models/daekeun-ml/ko-trocr-small",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: imageBytes,
    }
  );

  if (!response.ok) {
    console.error("ko-TrOCR API 오류:", response.status, await response.text());
    return "";
  }

  const result = await response.json();
  return result[0]?.generated_text || "";
}

// -------------------------
// Qwen 멀티모달 (Alt tag 생성)
// -------------------------
async function runVLModel(imagePath, ocrText) {
  const resizedBuffer = await sharp(imagePath)
    .resize({ width: 512 })
    .jpeg({ quality: 80 })
    .toBuffer();

  const base64Image = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: ocrText
            ? `이미지에서 추출된 텍스트: "${ocrText}". 이를 참고하여 장면과 조합해 Alt tag를 100자 내외로 생성해 주세요.`
            : "이 이미지를 설명하는 Alt tag를 100자 내외로 생성해 주세요.",
        },
        { type: "image_url", image_url: { url: base64Image } },
      ],
    },
  ];

  const chatCompletion = await client.chat.completions.create({
    model: "Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic",
    messages,
  });

  return chatCompletion.choices[0].message.content || "Alt tag 생성 실패";
}

// -------------------------
// Alt tag API 엔드포인트
// -------------------------
app.post("/api/generate-alt", upload.single("image"), async (req, res) => {
  try {
    // OCR 먼저 실행
    const ocrText = await runKoTrOCR(req.file.path);

    // Qwen으로 Alt tag 생성
    const altTag = await runVLModel(req.file.path, ocrText);

    fs.unlinkSync(req.file.path); // 임시 파일 삭제

    res.json({ altTag, ocrText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Alt tag 생성 실패" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on ${PORT}`)
);