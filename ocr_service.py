import os
from flask import Flask, request, jsonify
from paddleocr import PaddleOCR

app = Flask(__name__)

# 최신 PaddleOCR 초기화 (use_gpu 제거, use_textline_orientation 사용)
ocr = PaddleOCR(
    lang='korean',
    use_textline_orientation=True
)

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

    results = ocr.ocr(temp_path)

    os.remove(temp_path)

    texts = []
    for res in results:
        for line in res:
            texts.append(line[1][0])

    return jsonify({"ocr_text": " ".join(texts)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))  # Render에서 지정하는 포트 사용
    app.run(host="0.0.0.0", port=port)