import os
from flask import Flask, request, jsonify
from paddleocr import PaddleOCR

app = Flask(__name__)

# OCR 모델 지연 초기화 (Lazy Load)
ocr = None

@app.route("/")
def health():
    return "✅ OCR Service Running"

@app.route("/ocr", methods=["POST"])
def run_ocr():
    global ocr
    if ocr is None:
        # 첫 요청에서만 PaddleOCR 모델 로드 → Render에서 포트 타임아웃 방지
        ocr = PaddleOCR(
            lang='korean',
            use_textline_orientation=True  # 최신 버전 권장 옵션
        )

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files["image"]
    temp_path = "temp.jpg"
    image_file.save(temp_path)

    results = ocr.ocr(temp_path)
    os.remove(temp_path)

    texts = []
    for res in results:
        for line in res:
            texts.append(line[1][0])

    return jsonify({"ocr_text": " ".join(texts)})

if __name__ == "__main__":
    # Render가 자동으로 PORT 환경변수를 지정
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)