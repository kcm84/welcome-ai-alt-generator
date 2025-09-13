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

규칙:

1. 이미지 안에서 인식된 모든 텍스트를 그대로 출력합니다.  
   - 각 텍스트는 줄바꿈(\n)으로 구분합니다.  
   - 절대로 합치거나 요약하지 않습니다.  

2. 이미지가 텍스트만 포함한다면:  
   - 인식된 텍스트를 줄 단위로 그대로 출력하세요.  

3. 이미지가 텍스트와 장면을 함께 포함한다면:  
   - 먼저 인식된 텍스트를 모두 줄 단위로 출력하고,  
   - 마지막 줄에 “장면 설명: ...” 형식으로 추가하세요.  

4. 이미지가 **표(Table)나 문서 형식(Document layout)**인 경우:  
   - 표는 행(Row) 단위로 읽어서 줄바꿈으로 구분해 출력하세요.  
   - 문서(예: 공문, 계약서, 영수증 등)는 줄 단위/문단 단위로 최대한 원문 그대로 출력하세요.  
   - 단, 너무 길 경우에도 가능한 한 많이 보존하세요.  

5. 이미지에 **텍스트가 전혀 없는 경우**:  
   - 장면 설명만 100자 내외로 출력하세요.  
   - 예: “장면 설명: 푸른 하늘과 바다가 펼쳐진 풍경”  

6. 최종 결과는 Alt tag 용도로 자연스럽게 작성하세요.  
   - OCR 텍스트는 있는 그대로 보여주고,  
   - 필요 시 마지막 줄에 간단한 장면 설명을 추가하세요.
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
      model: "Qwen/Qwen2.5-VL-32B-Instruct",
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