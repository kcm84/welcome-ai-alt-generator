import os
from flask import Flask, request, jsonify
from paddleocr import PaddleOCR

app = Flask(__name__)

# PaddleOCR 초기화 (최신 버전 호환)
# use_angle_cls → use_textline_orientation
ocr = PaddleOCR(
    lang='korean',
    use_textline_orientation=True  # 최신 버전에서 권장되는 옵션
)

@app.route("/")
def health():
    return "OCR Service Running ✅"

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
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)