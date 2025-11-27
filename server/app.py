# from fastapi import FastAPI, File, UploadFile
# from fastapi.middleware.cors import CORSMiddleware
# from transformers import BlipProcessor, BlipForConditionalGeneration
# from gtts import gTTS
# from io import BytesIO
# from PIL import Image
# import uuid
# import os
# from fastapi.responses import FileResponse

# app = FastAPI()

# # Allow RN app to call API
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Load BLIP model once
# print("[INFO] Loading BLIP model...")
# processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
# model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
# print("[INFO] Model loaded!")

# def generate_caption(image: Image.Image):
#     inputs = processor(image.convert('RGB'), return_tensors="pt")
#     out = model.generate(**inputs)
#     caption = processor.decode(out[0], skip_special_tokens=True)
#     return caption

# @app.post("/caption")
# async def caption_image(file: UploadFile = File(...)):
#     # Read image
#     image_bytes = await file.read()
#     image = Image.open(BytesIO(image_bytes))
    
#     # Generate caption
#     caption = generate_caption(image)

#     # Generate TTS
#     tts = gTTS(text=caption, lang="en")
#     audio_filename = f"{uuid.uuid4()}.mp3"
#     tts.save(audio_filename)

#     # Return caption + audio URL
#     return {"caption": caption, "audio_file": audio_filename}

# @app.get("/audio/{filename}")
# async def get_audio(filename: str):
#     if os.path.exists(filename):
#         return FileResponse(filename, media_type="audio/mpeg")
#     return {"error": "File not found"}


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

# Load BLIP model once
logger.info("Loading BLIP model...")
try:
    processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
    model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
    logger.info("Model loaded successfully!")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    raise e

def generate_caption(image: Image.Image):
    try:
        inputs = processor(image.convert('RGB'), return_tensors="pt")
        out = model.generate(**inputs, max_length=50, num_beams=4)
        caption = processor.decode(out[0], skip_special_tokens=True)
        return caption
    except Exception as e:
        logger.error(f"Caption generation failed: {e}")
        raise e

@app.get("/")
async def root():
    return {"message": "Server is running", "status": "healthy"}

@app.post("/caption")
async def caption_image(file: UploadFile = File(...)):
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read image
        image_bytes = await file.read()
        image = Image.open(BytesIO(image_bytes))
        
        # Generate caption
        caption = generate_caption(image)
        logger.info(f"Generated caption: {caption}")

        # Generate TTS
        try:
            tts = gTTS(text=caption, lang="en")
            audio_filename = f"{uuid.uuid4()}.mp3"
            tts.save(audio_filename)
            logger.info(f"Audio file saved: {audio_filename}")
        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            # Return caption even if TTS fails
            audio_filename = None

        return {
            "caption": caption, 
            "audio_file": audio_filename,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Caption endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/audio/{filename}")
async def get_audio(filename: str):
    try:
        if not os.path.exists(filename):
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        return FileResponse(
            filename, 
            media_type="audio/mpeg",
            filename=f"description_{filename}"
        )
    except Exception as e:
        logger.error(f"Audio endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Clean up audio files periodically
import asyncio
import glob

@app.on_event("startup")
async def startup_event():
    # Clean up old audio files on startup
    for file in glob.glob("*.mp3"):
        try:
            os.remove(file)
            logger.info(f"Cleaned up old file: {file}")
        except:
            pass