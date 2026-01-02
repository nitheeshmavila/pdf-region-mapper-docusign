from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pdf2image import convert_from_bytes
from datetime import datetime
import uuid, os, json
from typing import Dict, List

app = FastAPI(
    title="PDF Region Selector API",
    description="API for saving DocuSign-compatible PDF field mappings",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Pydantic model for field mappings validation
class FieldMapping(BaseModel):
    field_name: str
    coordinates: List[int]  # [y1, x1, y2, x2, pageNumber]

@app.get("/")
async def root():
    return {
        "message": "PDF Region Selector API",
        "endpoints": {
            "/upload": "POST - Upload PDF and convert to images (legacy)",
            "/save-fields": "POST - Save field mappings in DocuSign format"
        }
    }

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Legacy endpoint: Upload PDF and convert to images.
    Note: Frontend now uses pdf.js for rendering, but this endpoint
    remains for backward compatibility or server-side processing.
    """
    try:
        pdf_bytes = await file.read()
        pdf_id = str(uuid.uuid4())

        images = convert_from_bytes(pdf_bytes)
        pages = []

        for i, img in enumerate(images):
            path = f"{UPLOAD_DIR}/{pdf_id}_page_{i+1}.png"
            img.save(path)
            pages.append(path)

        return {
            "pdf_id": pdf_id,
            "pages": pages,
            "total_pages": len(pages)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.post("/save-fields")
async def save_fields(payload: Dict[str, List[int]]):
    """
    Save field mappings in DocuSign-compatible format.
    
    Expected format:
    {
        "Field Name": [y1, x1, y2, x2, pageNumber],
        ...
    }
    
    Coordinates are normalized to 0-1000 scale.
    """
    try:
        # Validate payload structure
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Payload must be a dictionary")
        
        validated_mappings = {}
        for field_name, coords in payload.items():
            if not isinstance(coords, list) or len(coords) != 5:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid coordinates for field '{field_name}'. Expected [y1, x1, y2, x2, pageNumber]"
                )
            
            # Validate coordinate values
            y1, x1, y2, x2, page_num = coords
            if not all(isinstance(c, (int, float)) for c in coords[:4]):
                raise HTTPException(
                    status_code=400,
                    detail=f"Coordinates must be numbers for field '{field_name}'"
                )
            
            if not (0 <= y1 <= 1000 and 0 <= x1 <= 1000 and 
                    0 <= y2 <= 1000 and 0 <= x2 <= 1000):
                raise HTTPException(
                    status_code=400,
                    detail=f"Coordinates must be in 0-1000 range for field '{field_name}'"
                )
            
            if y1 >= y2 or x1 >= x2:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid rectangle: y1 < y2 and x1 < x2 required for field '{field_name}'"
                )
            
            if page_num < 1:
                raise HTTPException(
                    status_code=400,
                    detail=f"Page number must be >= 1 for field '{field_name}'"
                )
            
            validated_mappings[field_name] = coords
        
        # Save with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{OUTPUT_DIR}/fields_{timestamp}.json"
        
        output_data = {
            "timestamp": datetime.now().isoformat(),
            "format": "DocuSign-compatible",
            "coordinate_scale": "0-1000",
            "fields": validated_mappings
        }
        
        with open(filename, "w") as f:
            json.dump(output_data, f, indent=2)
        
        # Also save latest version
        with open(f"{OUTPUT_DIR}/fields_latest.json", "w") as f:
            json.dump(output_data, f, indent=2)
        
        return {
            "status": "saved",
            "filename": filename,
            "fields_count": len(validated_mappings),
            "timestamp": output_data["timestamp"]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving fields: {str(e)}")

@app.get("/fields/latest")
async def get_latest_fields():
    """Get the most recently saved field mappings."""
    latest_file = f"{OUTPUT_DIR}/fields_latest.json"
    if not os.path.exists(latest_file):
        raise HTTPException(status_code=404, detail="No fields saved yet")
    
    with open(latest_file, "r") as f:
        return json.load(f)
