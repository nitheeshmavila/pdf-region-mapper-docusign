# Quick Setup Guide

## Local Development

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 10000
```

Backend will be available at `http://localhost:10000`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 3. Configure Backend URL (Optional)

Create `frontend/.env`:
```env
VITE_BACKEND_URL=http://localhost:10000
```

If not set, defaults to `http://localhost:10000`

## Testing

1. Open `http://localhost:3000` in your browser
2. Click "Upload PDF" and select a PDF file
3. Select a field from the sidebar
4. Click and drag on the PDF to draw a rectangle
5. Navigate pages with arrow buttons or keyboard (← → or n/p)
6. Map more fields as needed
7. Click "Save Fields" to save to backend

## Docker (Backend)

```bash
cd backend
docker build -t pdf-region-backend .
docker run -p 10000:10000 pdf-region-backend
```

## Production Deployment

See `README.md` for Vercel (frontend) and Render (backend) deployment instructions.

