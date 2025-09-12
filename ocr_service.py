from paddleocr import PaddleOCR
from flask import Flask, request, jsonify
import os

app = Flask(__name__)

# Korean OCR (PP-OCRv4_mobile)
ocr = PaddleOCR(use_angle_cls=True, lang='korean', use_gpu=False)

@app.route("/ocr", methods=["POST"])
def run_ocr():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files["image"]
    temp_path = "temp.jpg"
    image_file.save(temp_path)

    results = ocr.ocr(temp_path, cls=True)
    os.remove(temp_path)

    texts = []
    for res in results:
        for line in res:
            texts.append(line[1][0])

    return jsonify({"ocr_text": " ".join(texts)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)