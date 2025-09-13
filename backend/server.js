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
당신은 이미지에서 Alt tag를 생성하는 AI입니다. Alt tag는 이미지에 포함된 장면과 텍스트를 모두 설명하는 짧은 문장입니다.

규칙:
1. 이미지 안에 글자가 포함되어 있다면, 모든 텍스트를 빠짐없이 추출하여 Alt tag에 반드시 포함시킵니다.  
   - 여러 줄의 문구가 있을 경우, 줄 단위로 나눠서 그대로 모두 반영합니다.  
   - 절대로 여러 줄을 한 줄로 합치지 마세요.  
   - 이미지에 텍스트만 있을 경우, 모든 텍스트를 그대로 Alt tag로 사용합니다.

2. 이미지에 텍스트가 없을 경우, 장면 설명을 작성합니다.  
   - 사람, 사물, 배경, 분위기를 간단하면서도 명확하게 기술합니다.  
   - 불필요하게 긴 설명은 피하고, 80~120자 내외로 유지합니다.

3. 표현은 자연스러운 한국어로 작성합니다.  
   - 불필요한 부사, 감탄사(예: "아름다운", "놀라운")는 최소화합니다.  
   - 핵심 정보만 간결하게 담습니다.  

출력 형식:
- Alt tag만 결과로 출력합니다.  
- 따옴표, 불필요한 마크업 없이 텍스트만 반환합니다.

예시:
- 이미지에 "웰컴디지털뱅크"와 "최고 금리 혜택" 문구가 있다면 →  
  Alt tag: "웰컴디지털뱅크\n최고 금리 혜택"
- 이미지에 텍스트가 없고, 카페에서 노트북을 사용하는 사람이 있는 경우 →  
  Alt tag: "카페에서 노트북으로 작업하는 남성과 커피잔이 있는 장면"
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