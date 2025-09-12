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
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files["image"]
    temp_path = "temp.jpg"
    image_file.save(temp_path)

    results = ocr.predict(temp_path)
    os.remove(temp_path)

    texts = []
    for res in results:
        for line in res:
            texts.append(line[1][0])  # 각 줄 텍스트 추출

    return jsonify({
        "ocr_texts": texts,                 # 모든 줄 텍스트 배열
        "ocr_text_joined": " ".join(texts)  # 합친 텍스트 (백엔드에서 사용 가능)
    })

if __name__ == "__main__":
    # Render가 자동으로 PORT 환경변수를 지정
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)