from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import BlipProcessor, BlipForConditionalGeneration
from gtts import gTTS
from io import BytesIO
from PIL import Image
import uuid
import os
from fastapi.responses import FileResponse
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Load BLIP Captioning Model
# -----------------------------
logger.info("Loading BLIP model...")
try:
    processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
    model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
    logger.info("BLIP model loaded successfully!")
except Exception as e:
    logger.error(f"Failed to load BLIP model: {e}")
    raise e


# -----------------------------
# BLIP Captioning Helper
# -----------------------------
def generate_caption(image: Image.Image):
    try:
        inputs = processor(image.convert("RGB"), return_tensors="pt")
        output = model.generate(**inputs)
        caption = processor.decode(output[0], skip_special_tokens=True)
        return caption
    except Exception as e:
        logger.error(f"Caption generation failed: {e}")
        raise e


# -----------------------------
# Generate MP3 using gTTS
# -----------------------------
def generate_audio(text):
    filename = f"{uuid.uuid4()}.mp3"
    tts = gTTS(text=text, lang="en")
    tts.save(filename)
    return filename


# -----------------------------
# ROUTES
# -----------------------------

@app.get("/")
async def root():
    return {"message": "Server is running", "status": "healthy"}


# =============================
# BLIP CAPTION ENDPOINT
# =============================
@app.post("/caption")
async def caption_image(file: UploadFile = File(...)):
    try:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        # Read image
        image_bytes = await file.read()
        image = Image.open(BytesIO(image_bytes))

        # Generate caption
        caption = generate_caption(image)
        logger.info(f"Generated caption: {caption}")

        # Generate audio
        audio_filename = generate_audio(caption)

        return {
            "caption": caption,
            "audio_file": audio_filename,
            "status": "success",
        }

    except Exception as e:
        logger.error(f"Caption endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================
# AUDIO FILE ACCESS
# =============================
@app.get("/audio/{filename}")
async def get_audio(filename: str):
    if not os.path.exists(filename):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(filename, media_type="audio/mpeg")


# =============================
# CLEANUP OLD AUDIO FILES
# =============================
import glob

@app.on_event("startup")
async def cleanup_old_audio():
    for file in glob.glob("*.mp3"):
        try:
            os.remove(file)
        except:
            pass


# from fastapi import FastAPI, File, UploadFile, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from transformers import BlipProcessor, BlipForConditionalGeneration
# from gtts import gTTS
# from io import BytesIO
# from PIL import Image
# import uuid
# import os
# from fastapi.responses import FileResponse
# import logging
# import glob

# # Torchvision for object detection
# import torch
# import torchvision
# from torchvision import transforms as T

# # -----------------------------
# # Setup Logging
# # -----------------------------
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # -----------------------------
# # FastAPI App
# # -----------------------------
# app = FastAPI()

# # CORS configuration
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # -----------------------------
# # Load BLIP Captioning Model
# # -----------------------------
# logger.info("Loading BLIP model...")
# try:
#     processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
#     model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
#     logger.info("BLIP model loaded successfully!")
# except Exception as e:
#     logger.error(f"Failed to load BLIP model: {e}")
#     raise e

# # -----------------------------
# # Load Torchvision Object Detection Model
# # -----------------------------
# logger.info("Loading Torchvision Faster R-CNN model...")
# try:
#     detection_model = torchvision.models.detection.fasterrcnn_resnet50_fpn(pretrained=True)
#     detection_model.eval()
#     logger.info("Object detection model loaded successfully!")
# except Exception as e:
#     logger.error(f"Failed to load object detection model: {e}")
#     raise e

# # COCO labels
# COCO_LABELS = [
#     '__background__','person','bicycle','car','motorcycle','airplane','bus','train',
#     'truck','boat','traffic light','fire hydrant','stop sign','parking meter','bench',
#     'bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe',
#     'backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard',
#     'sports ball','kite','baseball bat','baseball glove','skateboard','surfboard',
#     'tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl','banana',
#     'apple','sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake',
#     'chair','couch','potted plant','bed','dining table','toilet','tv','laptop','mouse',
#     'remote','keyboard','cell phone','microwave','oven','toaster','sink','refrigerator',
#     'book','clock','vase','scissors','teddy bear','hair drier','toothbrush'
# ]

# # -----------------------------
# # Helper: Generate Caption
# # -----------------------------
# def generate_caption(image: Image.Image):
#     try:
#         inputs = processor(image.convert("RGB"), return_tensors="pt")
#         output = model.generate(**inputs)
#         caption = processor.decode(output[0], skip_special_tokens=True)
#         return caption
#     except Exception as e:
#         logger.error(f"Caption generation failed: {e}")
#         raise e

# # -----------------------------
# # Helper: Object Detection (Torchvision)
# # -----------------------------
# def detect_objects_torch(image: Image.Image, threshold=0.5):
#     try:
#         transform = T.Compose([T.ToTensor()])
#         img_tensor = transform(image)
#         with torch.no_grad():
#             predictions = detection_model([img_tensor])[0]

#         detected = []
#         for label, score in zip(predictions['labels'], predictions['scores']):
#             if score >= threshold:
#                 detected.append({
#                     "object": COCO_LABELS[label.item()],
#                     "confidence": round(score.item(), 3)
#                 })
#         return detected
#     except Exception as e:
#         logger.error(f"Object detection failed: {e}")
#         return []

# # -----------------------------
# # Helper: Generate Audio (gTTS)
# # -----------------------------
# def generate_audio(text):
#     filename = f"{uuid.uuid4()}.mp3"
#     tts = gTTS(text=text, lang="en")
#     tts.save(filename)
#     return filename

# # -----------------------------
# # Routes
# # -----------------------------
# @app.get("/")
# async def root():
#     return {"message": "Server is running", "status": "healthy"}

# # =============================
# # Analyze Image: Caption + Detection + Audio
# # =============================
# @app.post("/analyze")
# async def analyze_image(file: UploadFile = File(...)):
#     try:
#         if not file.content_type.startswith("image/"):
#             raise HTTPException(status_code=400, detail="File must be an image")

#         # Read image
#         image_bytes = await file.read()
#         image = Image.open(BytesIO(image_bytes))

#         # Generate caption
#         caption = generate_caption(image)

#         # Detect objects
#         objects = detect_objects_torch(image)

#         # Build explanation text
#         detected_names = ", ".join([obj["object"] for obj in objects]) if objects else "no clear objects"
#         explanation = f"{caption}. I also detected: {detected_names}."

#         # Generate audio
#         audio_filename = generate_audio(explanation)

#         return {
#             "caption": caption,
#             "objects": objects,
#             "audio_file": audio_filename,
#             "status": "success"
#         }

#     except Exception as e:
#         logger.error(f"Analyze endpoint error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))

# # =============================
# # Audio file access
# # =============================
# @app.get("/audio/{filename}")
# async def get_audio(filename: str):
#     if not os.path.exists(filename):
#         raise HTTPException(status_code=404, detail="File not found")

#     return FileResponse(filename, media_type="audio/mpeg")

# # =============================
# # Cleanup old audio files
# # =============================
# @app.on_event("startup")
# async def cleanup_old_audio():
#     for file in glob.glob("*.mp3"):
#         try:
#             os.remove(file)
#         except:
#             pass
