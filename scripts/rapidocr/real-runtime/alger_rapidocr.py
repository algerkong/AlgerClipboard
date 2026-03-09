#!/usr/bin/env python3

import argparse
import json
import logging
import sys
import warnings
from pathlib import Path

warnings.filterwarnings(
    "ignore",
    message="Unable to find acceptable character detection dependency",
)

from PIL import Image
from rapidocr import RapidOCR


def configure_logging() -> None:
    logging.disable(logging.CRITICAL)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Image path")
    return parser.parse_args()


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def get_image_size(image_path: Path) -> tuple[int, int]:
    with Image.open(image_path) as image:
        return image.width, image.height


def make_line(text: str, box, image_width: int, image_height: int) -> dict[str, float | str]:
    xs = [float(point[0]) for point in box]
    ys = [float(point[1]) for point in box]
    left = min(xs)
    top = min(ys)
    right = max(xs)
    bottom = max(ys)

    return {
        "text": text,
        "x": clamp(left / image_width) if image_width else 0.0,
        "y": clamp(top / image_height) if image_height else 0.0,
        "width": clamp((right - left) / image_width) if image_width else 0.0,
        "height": clamp((bottom - top) / image_height) if image_height else 0.0,
    }


def main() -> int:
    configure_logging()
    args = parse_args()
    image_path = Path(args.input)

    if not image_path.is_file():
        print(f"Input image not found: {image_path}", file=sys.stderr)
        return 1

    image_width, image_height = get_image_size(image_path)

    try:
        engine = RapidOCR()
        output = engine(str(image_path))
    except Exception as exc:  # noqa: BLE001
        print(f"RapidOCR failed: {exc}", file=sys.stderr)
        return 1

    lines = []
    raw_boxes = getattr(output, "boxes", None)
    raw_texts = getattr(output, "txts", None)
    boxes = [] if raw_boxes is None else list(raw_boxes)
    texts = [] if raw_texts is None else list(raw_texts)

    for box, text in zip(boxes, texts):
        text = str(text).strip()
        if not text:
            continue
        lines.append(make_line(text, box, image_width, image_height))

    result = {
        "lines": lines,
        "image_width": image_width,
        "image_height": image_height,
    }
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
